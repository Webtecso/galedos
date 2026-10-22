-- Galedos Gestão · Ronda 4b: ausências, feriados, dias de trabalho e cálculo de faltas

alter table public.config_presenca
  add column dias_trabalho integer[] not null default array[1,2,3,4,5]
  check (cardinality(dias_trabalho) between 1 and 7 and dias_trabalho <@ array[1,2,3,4,5,6,7]);

create or replace function public.alterar_dias_trabalho(p_dias integer[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_dias integer[];
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  select array_agg(distinct x order by x) into v_dias from unnest(coalesce(p_dias, array[]::integer[])) x;
  if v_dias is null or cardinality(v_dias) = 0 then
    raise exception 'Seleccione pelo menos um dia de trabalho.';
  end if;
  if not (v_dias <@ array[1,2,3,4,5,6,7]) then
    raise exception 'Dias de trabalho inválidos.';
  end if;
  update public.config_presenca set dias_trabalho = v_dias, actualizado_em = now() where id = 1;
end;
$$;
revoke execute on function public.alterar_dias_trabalho(integer[]) from public, anon;
grant execute on function public.alterar_dias_trabalho(integer[]) to authenticated;

-- ===================== FERIADOS =====================
create table public.feriados (
  id text primary key default gen_random_uuid()::text,
  data date not null unique,
  nome text not null check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);
alter table public.feriados enable row level security;
create policy feriados_ver on public.feriados for select to authenticated using (public.e_gestao());
revoke all on public.feriados from anon, authenticated;
grant select on public.feriados to authenticated;
create trigger feriados_auditoria after insert or update or delete on public.feriados
  for each row execute function public.auditar();

-- Feriados de data fixa e os móveis de 2026 e 2027. Confirmar com o calendário oficial.
insert into public.feriados (data, nome) values
  ('2026-01-01', 'Ano Novo'),
  ('2026-02-04', 'Início da Luta Armada de Libertação Nacional'),
  ('2026-02-17', 'Carnaval'),
  ('2026-03-08', 'Dia Internacional da Mulher'),
  ('2026-03-23', 'Dia da Libertação da África Austral'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-04', 'Dia da Paz e Reconciliação Nacional'),
  ('2026-05-01', 'Dia do Trabalhador'),
  ('2026-09-17', 'Dia do Herói Nacional'),
  ('2026-11-02', 'Dia dos Finados'),
  ('2026-11-11', 'Dia da Independência Nacional'),
  ('2026-12-25', 'Natal'),
  ('2027-01-01', 'Ano Novo'),
  ('2027-02-04', 'Início da Luta Armada de Libertação Nacional'),
  ('2027-02-09', 'Carnaval'),
  ('2027-03-08', 'Dia Internacional da Mulher'),
  ('2027-03-23', 'Dia da Libertação da África Austral'),
  ('2027-03-26', 'Sexta-feira Santa'),
  ('2027-04-04', 'Dia da Paz e Reconciliação Nacional'),
  ('2027-05-01', 'Dia do Trabalhador'),
  ('2027-09-17', 'Dia do Herói Nacional'),
  ('2027-11-02', 'Dia dos Finados'),
  ('2027-11-11', 'Dia da Independência Nacional'),
  ('2027-12-25', 'Natal');

create or replace function public.adicionar_feriado(p_data date, p_nome text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := left(trim(coalesce(p_nome, '')), 120);
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_data is null then
    raise exception 'Indique a data do feriado.';
  end if;
  if v_nome = '' then
    raise exception 'Indique o nome do feriado.';
  end if;
  if exists (select 1 from public.feriados where data = p_data) then
    raise exception 'Já existe um feriado nesta data.';
  end if;
  insert into public.feriados (data, nome) values (p_data, v_nome);
end;
$$;
revoke execute on function public.adicionar_feriado(date, text) from public, anon;
grant execute on function public.adicionar_feriado(date, text) to authenticated;

create or replace function public.remover_feriado(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  delete from public.feriados where id = p_id;
  if not found then
    raise exception 'Feriado não encontrado.';
  end if;
end;
$$;
revoke execute on function public.remover_feriado(text) from public, anon;
grant execute on function public.remover_feriado(text) to authenticated;

-- ===================== AUSÊNCIAS =====================
create table public.ausencias (
  id text primary key default gen_random_uuid()::text,
  colaborador_id text not null references public.colaboradores (id),
  tipo text not null check (tipo in ('Férias', 'Baixa médica', 'Licença', 'Falta justificada', 'Outra')),
  data_inicio date not null,
  data_fim date not null,
  motivo text not null default '',
  estado text not null default 'Activa' check (estado in ('Activa', 'Anulada')),
  motivo_anulacao text not null default '',
  registado_por text not null default 'Sistema',
  criado_em timestamptz not null default now(),
  constraint ausencia_datas check (data_fim >= data_inicio),
  constraint ausencia_anulada_com_motivo check (estado <> 'Anulada' or length(trim(motivo_anulacao)) > 0)
);
create index ausencias_colaborador_idx on public.ausencias (colaborador_id, data_inicio);

alter table public.ausencias enable row level security;
create policy ausencias_ver on public.ausencias for select to authenticated
  using (public.e_gestao() or colaborador_id = public.colaborador_actual());
revoke all on public.ausencias from anon, authenticated;
grant select on public.ausencias to authenticated;

create or replace function public.ausencias_regras()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.estado <> 'Activa' then
    raise exception 'Esta ausência já foi anulada.';
  end if;
  if (to_jsonb(new) - 'estado' - 'motivo_anulacao') is distinct from (to_jsonb(old) - 'estado' - 'motivo_anulacao') then
    raise exception 'Os dados da ausência não podem ser alterados. Anule-a e registe outra.';
  end if;
  return new;
end;
$$;
revoke execute on function public.ausencias_regras() from public, anon, authenticated;
create trigger ausencias_a_regras before update on public.ausencias
  for each row execute function public.ausencias_regras();
create trigger ausencias_b_auditoria after insert or update or delete on public.ausencias
  for each row execute function public.auditar();

create or replace function public.registar_ausencia(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_col text := nullif(trim(coalesce(p ->> 'colaborador_id', '')), '');
  v_tipo text := trim(coalesce(p ->> 'tipo', ''));
  v_ini date := nullif(p ->> 'data_inicio', '')::date;
  v_fim date := nullif(p ->> 'data_fim', '')::date;
  v_motivo text := left(trim(coalesce(p ->> 'motivo', '')), 500);
  v_id text;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  perform 1 from public.colaboradores where id = v_col for update;
  if not found then
    raise exception 'Seleccione o colaborador.';
  end if;
  if v_tipo not in ('Férias', 'Baixa médica', 'Licença', 'Falta justificada', 'Outra') then
    raise exception 'Seleccione o tipo de ausência.';
  end if;
  if v_ini is null or v_fim is null then
    raise exception 'Indique as datas de início e de fim.';
  end if;
  if v_fim < v_ini then
    raise exception 'A data de fim não pode ser anterior à de início.';
  end if;
  if v_fim - v_ini > 120 then
    raise exception 'A ausência não pode ter mais de 120 dias. Divida-a em várias.';
  end if;
  if v_tipo in ('Falta justificada', 'Outra') and v_motivo = '' then
    raise exception 'Indique o motivo da ausência.';
  end if;
  if exists (
    select 1 from public.ausencias a
    where a.colaborador_id = v_col and a.estado = 'Activa'
      and daterange(a.data_inicio, a.data_fim, '[]') && daterange(v_ini, v_fim, '[]')) then
    raise exception 'O colaborador já tem uma ausência registada nestas datas.';
  end if;
  insert into public.ausencias (colaborador_id, tipo, data_inicio, data_fim, motivo, registado_por)
  values (v_col, v_tipo, v_ini, v_fim, v_motivo, public.nome_utilizador_actual())
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.registar_ausencia(jsonb) from public, anon;
grant execute on function public.registar_ausencia(jsonb) to authenticated;

create or replace function public.anular_ausencia(p_id text, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_motivo text := left(trim(coalesce(p_motivo, '')), 500);
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if v_motivo = '' then
    raise exception 'Indique o motivo da anulação.';
  end if;
  update public.ausencias set estado = 'Anulada', motivo_anulacao = v_motivo where id = p_id;
  if not found then
    raise exception 'Ausência não encontrada.';
  end if;
end;
$$;
revoke execute on function public.anular_ausencia(text, text) from public, anon;
grant execute on function public.anular_ausencia(text, text) to authenticated;

-- ===================== FALTAS DO MÊS =====================
-- Dias de trabalho, até ontem, sem presença, sem feriado. Cada dia vem classificado:
-- tipo da ausência registada, "Justificada" (pedido aprovado) ou "Injustificada".
create or replace function public.faltas_mes(p_mes text)
returns table (colaborador_id text, dia date, situacao text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ini date;
  v_fim date;
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_dias integer[];
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_mes is null or p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período inválido.';
  end if;
  v_ini := (p_mes || '-01')::date;
  v_fim := least(((v_ini + interval '1 month')::date) - 1, v_hoje - 1);
  select c.dias_trabalho into v_dias from public.config_presenca c where c.id = 1;

  return query
  select c.id, g.dia::date,
    coalesce(
      (select a.tipo from public.ausencias a
       where a.colaborador_id = c.id and a.estado = 'Activa'
         and g.dia::date between a.data_inicio and a.data_fim
       limit 1),
      case when exists (
             select 1 from public.pedidos_colaborador pc
             where pc.colaborador_id = c.id and pc.tipo = 'Justificação'
               and pc.estado = 'Aprovado' and pc.data_referencia = g.dia::date)
           then 'Justificada' else 'Injustificada' end)
  from public.colaboradores c
  cross join generate_series(v_ini::timestamp, v_fim::timestamp, interval '1 day') as g(dia)
  where c.estado = 'Activo'
    and extract(isodow from g.dia)::integer = any (v_dias)
    and g.dia::date >= coalesce(c.data_inicio, (c.criado_em at time zone 'Africa/Luanda')::date)
    and g.dia::date >= (c.criado_em at time zone 'Africa/Luanda')::date
    and not exists (select 1 from public.feriados f where f.data = g.dia::date)
    and not exists (select 1 from public.presencas p where p.colaborador_id = c.id and p.data = g.dia::date)
  order by c.id, g.dia;
end;
$$;
revoke execute on function public.faltas_mes(text) from public, anon;
grant execute on function public.faltas_mes(text) to authenticated;