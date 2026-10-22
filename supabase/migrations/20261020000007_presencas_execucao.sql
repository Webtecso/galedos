-- Galedos Gestão · Base 4: contas de acesso, presenças e execução de serviços

create unique index perfis_colaborador_unico on public.perfis (colaborador_id) where colaborador_id is not null;

-- ===================== CONFIGURAÇÃO DE PRESENÇA =====================
create table public.config_presenca (
  id integer primary key default 1 check (id = 1),
  hora_entrada time not null default '08:00',
  hora_saida time not null default '17:00',
  tolerancia_min integer not null default 15 check (tolerancia_min >= 0 and tolerancia_min <= 120),
  janela_inicio_min integer not null default 30 check (janela_inicio_min >= 0 and janela_inicio_min <= 240),
  actualizado_em timestamptz not null default now()
);
insert into public.config_presenca (id) values (1);

alter table public.config_presenca enable row level security;
create policy config_presenca_ver on public.config_presenca for select to authenticated using (true);
revoke all on public.config_presenca from anon, authenticated;
grant select on public.config_presenca to authenticated;
create trigger config_presenca_auditoria after insert or update or delete on public.config_presenca
  for each row execute function public.auditar();

-- ===================== PRESENÇAS =====================
create table public.presencas (
  id text primary key default gen_random_uuid()::text,
  colaborador_id text not null references public.colaboradores (id),
  data date not null default ((now() at time zone 'Africa/Luanda')::date),
  entrada_em timestamptz not null default now(),
  saida_em timestamptz,
  entrada_lat numeric(9,6), entrada_lng numeric(9,6), entrada_precisao numeric(9,1),
  saida_lat numeric(9,6), saida_lng numeric(9,6), saida_precisao numeric(9,1),
  atraso_min integer not null default 0,
  validada boolean not null default false,
  validada_por text not null default '',
  validada_em timestamptz,
  motivo_correccao text not null default '',
  criado_em timestamptz not null default now(),
  constraint presenca_saida_valida check (saida_em is null or saida_em >= entrada_em)
);
create unique index presencas_uma_aberta on public.presencas (colaborador_id) where saida_em is null;
create unique index presencas_um_por_dia on public.presencas (colaborador_id, data);
create index presencas_data_idx on public.presencas (data);

create table public.pausas_presenca (
  id text primary key default gen_random_uuid()::text,
  presenca_id text not null references public.presencas (id),
  inicio_em timestamptz not null default now(),
  fim_em timestamptz,
  constraint pausa_fim_valido check (fim_em is null or fim_em >= inicio_em)
);
create unique index pausas_uma_aberta on public.pausas_presenca (presenca_id) where fim_em is null;
create index pausas_presenca_idx on public.pausas_presenca (presenca_id);

alter table public.presencas enable row level security;
create policy presencas_ver on public.presencas for select to authenticated
  using (public.e_gestao() or colaborador_id = public.colaborador_actual());
revoke all on public.presencas from anon, authenticated;
grant select on public.presencas to authenticated;

alter table public.pausas_presenca enable row level security;
create policy pausas_ver on public.pausas_presenca for select to authenticated
  using (exists (select 1 from public.presencas p where p.id = presenca_id
                 and (public.e_gestao() or p.colaborador_id = public.colaborador_actual())));
revoke all on public.pausas_presenca from anon, authenticated;
grant select on public.pausas_presenca to authenticated;

create trigger presencas_auditoria after insert or update or delete on public.presencas
  for each row execute function public.auditar();
create trigger pausas_auditoria after insert or update or delete on public.pausas_presenca
  for each row execute function public.auditar();

-- ===================== EXECUÇÃO DE SERVIÇOS =====================
create table public.execucoes_servico (
  id text primary key default gen_random_uuid()::text,
  servico_id text not null references public.servicos (id),
  colaborador_id text not null references public.colaboradores (id),
  chegada_em timestamptz, chegada_lat numeric(9,6), chegada_lng numeric(9,6), chegada_precisao numeric(9,1),
  inicio_em timestamptz, inicio_lat numeric(9,6), inicio_lng numeric(9,6), inicio_precisao numeric(9,1),
  fim_em timestamptz, fim_lat numeric(9,6), fim_lng numeric(9,6), fim_precisao numeric(9,1),
  observacoes text not null default '',
  motivo_correccao text not null default '',
  criado_em timestamptz not null default now(),
  unique (servico_id, colaborador_id),
  constraint execucao_ordem check (
    (chegada_em is null or inicio_em is null or inicio_em >= chegada_em)
    and (fim_em is null or (inicio_em is not null and fim_em >= inicio_em)))
);
create unique index execucoes_uma_aberta on public.execucoes_servico (colaborador_id)
  where inicio_em is not null and fim_em is null;
create index execucoes_servico_idx on public.execucoes_servico (servico_id);

alter table public.execucoes_servico enable row level security;
create policy execucoes_ver on public.execucoes_servico for select to authenticated
  using (public.e_gestao() or colaborador_id = public.colaborador_actual());
revoke all on public.execucoes_servico from anon, authenticated;
grant select on public.execucoes_servico to authenticated;

create trigger execucoes_auditoria after insert or update or delete on public.execucoes_servico
  for each row execute function public.auditar();

-- Um serviço só passa a "Concluído" quando ninguém o está a executar
create or replace function public.servicos_execucao_regra()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado_operacional = 'Concluído' and old.estado_operacional <> 'Concluído' then
    if exists (select 1 from public.execucoes_servico
               where servico_id = new.id and inicio_em is not null and fim_em is null) then
      raise exception 'Há colaboradores com este serviço ainda em curso. Aguarde que terminem.';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.servicos_execucao_regra() from public, anon, authenticated;
create trigger servicos_b2_execucao before update on public.servicos
  for each row execute function public.servicos_execucao_regra();

-- ===================== FUNÇÕES INTERNAS =====================
create or replace function public.colaborador_obrigatorio()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v text := public.colaborador_actual();
  v_estado text;
begin
  if v is null then
    raise exception 'Esta conta não está ligada a um colaborador. Contacte a administração.';
  end if;
  select estado into v_estado from public.colaboradores where id = v;
  if v_estado is distinct from 'Activo' then
    raise exception 'O colaborador não está activo. Contacte a administração.';
  end if;
  perform 1 from public.colaboradores where id = v for update;
  return v;
end;
$$;
revoke execute on function public.colaborador_obrigatorio() from public, anon, authenticated;

create or replace function public.verificar_trabalho(p_servico text, p_col text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
begin
  if not exists (select 1 from public.servico_colaboradores where servico_id = p_servico and colaborador_id = p_col) then
    raise exception 'Este serviço não lhe está atribuído.';
  end if;
  select estado_operacional into v_estado from public.servicos where id = p_servico;
  if v_estado is null or v_estado not in ('Agendado', 'Em execução') then
    raise exception 'Este serviço não está agendado nem em execução.';
  end if;
  if not exists (select 1 from public.presencas where colaborador_id = p_col and saida_em is null) then
    raise exception 'Marque primeiro a entrada no trabalho.';
  end if;
  if exists (select 1 from public.pausas_presenca pa join public.presencas pr on pr.id = pa.presenca_id
             where pr.colaborador_id = p_col and pa.fim_em is null) then
    raise exception 'Termine a pausa antes de trabalhar num serviço.';
  end if;
end;
$$;
revoke execute on function public.verificar_trabalho(text, text) from public, anon, authenticated;

-- ===================== PRESENÇA: ENTRADA, PAUSA, SAÍDA =====================
create or replace function public.marcar_entrada(p_lat numeric, p_lng numeric, p_precisao numeric)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_cfg record;
  v_ref timestamptz;
  v_min integer;
  v_lat numeric := p_lat;
  v_lng numeric := p_lng;
  v_prec numeric := p_precisao;
  v_id text;
begin
  if exists (select 1 from public.presencas where colaborador_id = v_col and saida_em is null and data < v_hoje) then
    raise exception 'Tem uma presença anterior sem saída registada. Peça à administração para a corrigir.';
  end if;
  if exists (select 1 from public.presencas where colaborador_id = v_col and data = v_hoje) then
    raise exception 'Já marcou a entrada hoje.';
  end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    v_lat := null; v_lng := null; v_prec := null;
  end if;
  select * into v_cfg from public.config_presenca where id = 1;
  v_ref := ((v_hoje + v_cfg.hora_entrada) at time zone 'Africa/Luanda');
  v_min := floor(extract(epoch from (now() - v_ref)) / 60);
  insert into public.presencas (colaborador_id, data, entrada_lat, entrada_lng, entrada_precisao, atraso_min)
  values (v_col, v_hoje, v_lat, v_lng, v_prec, case when v_min > v_cfg.tolerancia_min then v_min else 0 end)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.marcar_entrada(numeric, numeric, numeric) from public, anon;
grant execute on function public.marcar_entrada(numeric, numeric, numeric) to authenticated;

create or replace function public.marcar_saida(p_lat numeric, p_lng numeric, p_precisao numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_p record;
  v_lat numeric := p_lat;
  v_lng numeric := p_lng;
  v_prec numeric := p_precisao;
begin
  select * into v_p from public.presencas where colaborador_id = v_col and saida_em is null for update;
  if not found then
    raise exception 'Não tem uma entrada registada.';
  end if;
  if v_p.data < v_hoje then
    raise exception 'A presença de % ficou sem saída. Peça à administração para a corrigir.', to_char(v_p.data, 'DD/MM/YYYY');
  end if;
  if exists (select 1 from public.pausas_presenca where presenca_id = v_p.id and fim_em is null) then
    raise exception 'Termine a pausa antes de marcar a saída.';
  end if;
  if exists (select 1 from public.execucoes_servico where colaborador_id = v_col and inicio_em is not null and fim_em is null) then
    raise exception 'Termine o serviço em curso antes de marcar a saída.';
  end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    v_lat := null; v_lng := null; v_prec := null;
  end if;
  update public.presencas
  set saida_em = now(), saida_lat = v_lat, saida_lng = v_lng, saida_precisao = v_prec
  where id = v_p.id;
end;
$$;
revoke execute on function public.marcar_saida(numeric, numeric, numeric) from public, anon;
grant execute on function public.marcar_saida(numeric, numeric, numeric) to authenticated;

create or replace function public.iniciar_pausa()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_p record;
begin
  select * into v_p from public.presencas where colaborador_id = v_col and saida_em is null and data = v_hoje for update;
  if not found then
    raise exception 'Marque primeiro a entrada no trabalho.';
  end if;
  if exists (select 1 from public.pausas_presenca where presenca_id = v_p.id and fim_em is null) then
    raise exception 'Já tem uma pausa em curso.';
  end if;
  if exists (select 1 from public.execucoes_servico where colaborador_id = v_col and inicio_em is not null and fim_em is null) then
    raise exception 'Termine o serviço em curso antes de iniciar uma pausa.';
  end if;
  insert into public.pausas_presenca (presenca_id) values (v_p.id);
end;
$$;
revoke execute on function public.iniciar_pausa() from public, anon;
grant execute on function public.iniciar_pausa() to authenticated;

create or replace function public.terminar_pausa()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_n integer;
begin
  update public.pausas_presenca pa set fim_em = now()
  from public.presencas pr
  where pr.id = pa.presenca_id and pr.colaborador_id = v_col and pr.saida_em is null and pa.fim_em is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Não tem nenhuma pausa em curso.';
  end if;
end;
$$;
revoke execute on function public.terminar_pausa() from public, anon;
grant execute on function public.terminar_pausa() to authenticated;

-- ===================== EXECUÇÃO: CHEGADA, INÍCIO, FIM =====================
create or replace function public.marcar_chegada(p_servico text, p_lat numeric, p_lng numeric, p_precisao numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_lat numeric := p_lat;
  v_lng numeric := p_lng;
  v_prec numeric := p_precisao;
begin
  perform public.verificar_trabalho(p_servico, v_col);
  if exists (select 1 from public.execucoes_servico where servico_id = p_servico and colaborador_id = v_col) then
    raise exception 'Já marcou a chegada ou o início deste serviço.';
  end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    v_lat := null; v_lng := null; v_prec := null;
  end if;
  insert into public.execucoes_servico (servico_id, colaborador_id, chegada_em, chegada_lat, chegada_lng, chegada_precisao)
  values (p_servico, v_col, now(), v_lat, v_lng, v_prec);
  insert into public.servico_historico (servico_id, utilizador_nome, accao)
  values (p_servico, public.nome_utilizador_actual(), 'Chegada ao local registada');
end;
$$;
revoke execute on function public.marcar_chegada(text, numeric, numeric, numeric) from public, anon;
grant execute on function public.marcar_chegada(text, numeric, numeric, numeric) to authenticated;

create or replace function public.iniciar_execucao(p_servico text, p_lat numeric, p_lng numeric, p_precisao numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_srv record;
  v_exec record;
  v_cfg record;
  v_limite timestamptz;
  v_lat numeric := p_lat;
  v_lng numeric := p_lng;
  v_prec numeric := p_precisao;
begin
  perform public.verificar_trabalho(p_servico, v_col);
  if exists (select 1 from public.execucoes_servico where colaborador_id = v_col and inicio_em is not null and fim_em is null) then
    raise exception 'Já tem um serviço em curso. Termine-o antes de iniciar outro.';
  end if;
  select data, hora into v_srv from public.servicos where id = p_servico;
  select * into v_cfg from public.config_presenca where id = 1;
  if v_srv.data is not null and v_srv.hora is not null then
    v_limite := ((v_srv.data + v_srv.hora) at time zone 'Africa/Luanda') - make_interval(mins => v_cfg.janela_inicio_min);
    if now() < v_limite then
      raise exception 'Só pode iniciar este serviço a partir de %.', to_char(v_limite at time zone 'Africa/Luanda', 'DD/MM/YYYY HH24:MI');
    end if;
  end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    v_lat := null; v_lng := null; v_prec := null;
  end if;

  select * into v_exec from public.execucoes_servico where servico_id = p_servico and colaborador_id = v_col for update;
  if found and v_exec.inicio_em is not null then
    raise exception 'Já iniciou este serviço.';
  end if;
  if found then
    update public.execucoes_servico
    set inicio_em = now(), inicio_lat = v_lat, inicio_lng = v_lng, inicio_precisao = v_prec
    where id = v_exec.id;
  else
    insert into public.execucoes_servico (servico_id, colaborador_id, inicio_em, inicio_lat, inicio_lng, inicio_precisao)
    values (p_servico, v_col, now(), v_lat, v_lng, v_prec);
  end if;

  update public.servicos set estado_operacional = 'Em execução'
  where id = p_servico and estado_operacional = 'Agendado';
  insert into public.servico_historico (servico_id, utilizador_nome, accao)
  values (p_servico, public.nome_utilizador_actual(), 'Início da execução registado');
end;
$$;
revoke execute on function public.iniciar_execucao(text, numeric, numeric, numeric) from public, anon;
grant execute on function public.iniciar_execucao(text, numeric, numeric, numeric) to authenticated;

create or replace function public.terminar_execucao(p_servico text, p_lat numeric, p_lng numeric, p_precisao numeric, p_obs text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_exec record;
  v_obs text := left(trim(coalesce(p_obs, '')), 1000);
  v_lat numeric := p_lat;
  v_lng numeric := p_lng;
  v_prec numeric := p_precisao;
begin
  select * into v_exec from public.execucoes_servico where servico_id = p_servico and colaborador_id = v_col for update;
  if not found or v_exec.inicio_em is null then
    raise exception 'Ainda não iniciou este serviço.';
  end if;
  if v_exec.fim_em is not null then
    raise exception 'Já terminou este serviço.';
  end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    v_lat := null; v_lng := null; v_prec := null;
  end if;
  update public.execucoes_servico
  set fim_em = now(), fim_lat = v_lat, fim_lng = v_lng, fim_precisao = v_prec, observacoes = v_obs
  where id = v_exec.id;
  insert into public.servico_historico (servico_id, utilizador_nome, accao)
  values (p_servico, public.nome_utilizador_actual(),
          'Fim da execução registado' || case when v_obs <> '' then '. Observações: ' || v_obs else '' end);
  return not exists (
    select 1 from public.servico_colaboradores sc
    where sc.servico_id = p_servico
      and not exists (select 1 from public.execucoes_servico e
                      where e.servico_id = sc.servico_id and e.colaborador_id = sc.colaborador_id and e.fim_em is not null));
end;
$$;
revoke execute on function public.terminar_execucao(text, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.terminar_execucao(text, numeric, numeric, numeric, text) to authenticated;

-- ===================== OS MEUS SERVIÇOS (sem preços) =====================
create or replace function public.meus_servicos()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_actual();
  v_res jsonb;
begin
  if v_col is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(t.x order by t.ord_data, t.ord_hora), '[]'::jsonb) into v_res
  from (
    select
      jsonb_build_object(
        'id', s.id,
        'codigo', s.codigo,
        'tipo', s.tipo_servico,
        'descricao', s.descricao,
        'quantidade', s.quantidade,
        'data', s.data,
        'hora', left(s.hora::text, 5),
        'duracao', s.duracao_min,
        'local', s.local_execucao,
        'observacoes', s.observacoes,
        'estado', s.estado_operacional,
        'cliente', c.nome,
        'telefone', c.telefone,
        'equipa', (select coalesce(jsonb_agg(co.nome order by co.nome), '[]'::jsonb)
                   from public.servico_colaboradores sc2
                   join public.colaboradores co on co.id = sc2.colaborador_id
                   where sc2.servico_id = s.id),
        'chegada_em', e.chegada_em,
        'inicio_em', e.inicio_em,
        'fim_em', e.fim_em
      ) as x,
      s.data as ord_data,
      s.hora as ord_hora
    from public.servicos s
    join public.servico_colaboradores sc on sc.servico_id = s.id and sc.colaborador_id = v_col
    join public.clientes c on c.id = s.cliente_id
    left join public.execucoes_servico e on e.servico_id = s.id and e.colaborador_id = v_col
    where s.data is not null
      and (s.estado_operacional in ('Agendado', 'Em execução')
           or (s.estado_operacional = 'Concluído'
               and s.data >= ((now() at time zone 'Africa/Luanda')::date - 30)))
  ) t;
  return v_res;
end;
$$;
revoke execute on function public.meus_servicos() from public, anon;
grant execute on function public.meus_servicos() to authenticated;

-- ===================== ADMINISTRAÇÃO: PRESENÇAS =====================
create or replace function public.validar_presencas(p_ids text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  update public.presencas
  set validada = true, validada_por = public.nome_utilizador_actual(), validada_em = now()
  where id = any (p_ids) and not validada and saida_em is not null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Não há registos completos por validar.';
  end if;
  return v_n;
end;
$$;
revoke execute on function public.validar_presencas(text[]) from public, anon;
grant execute on function public.validar_presencas(text[]) to authenticated;

create or replace function public.corrigir_presenca(p_id text, p_entrada timestamptz, p_saida timestamptz, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p record;
  v_cfg record;
  v_ref timestamptz;
  v_min integer;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'O motivo da correcção é obrigatório.';
  end if;
  select * into v_p from public.presencas where id = p_id for update;
  if not found then
    raise exception 'Registo não encontrado.';
  end if;
  if p_entrada is null then
    raise exception 'Indique a hora de entrada.';
  end if;
  if (p_entrada at time zone 'Africa/Luanda')::date <> v_p.data then
    raise exception 'A entrada deve ser no dia do registo (%).', to_char(v_p.data, 'DD/MM/YYYY');
  end if;
  if p_entrada > now() or (p_saida is not null and p_saida > now()) then
    raise exception 'As horas não podem estar no futuro.';
  end if;
  if p_saida is not null and p_saida < p_entrada then
    raise exception 'A saída não pode ser anterior à entrada.';
  end if;
  select * into v_cfg from public.config_presenca where id = 1;
  v_ref := ((v_p.data + v_cfg.hora_entrada) at time zone 'Africa/Luanda');
  v_min := floor(extract(epoch from (p_entrada - v_ref)) / 60);
  update public.presencas
  set entrada_em = p_entrada,
      saida_em = p_saida,
      atraso_min = case when v_min > v_cfg.tolerancia_min then v_min else 0 end,
      validada = false, validada_por = '', validada_em = null,
      motivo_correccao = trim(p_motivo)
  where id = p_id;
end;
$$;
revoke execute on function public.corrigir_presenca(text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.corrigir_presenca(text, timestamptz, timestamptz, text) to authenticated;

create or replace function public.corrigir_execucao(p_id text, p_inicio timestamptz, p_fim timestamptz, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_e record;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'O motivo da correcção é obrigatório.';
  end if;
  select * into v_e from public.execucoes_servico where id = p_id for update;
  if not found then
    raise exception 'Registo não encontrado.';
  end if;
  if p_inicio is null or p_fim is null then
    raise exception 'Indique o início e o fim.';
  end if;
  if p_fim < p_inicio then
    raise exception 'O fim não pode ser anterior ao início.';
  end if;
  if p_inicio > now() or p_fim > now() then
    raise exception 'As horas não podem estar no futuro.';
  end if;
  if v_e.chegada_em is not null and p_inicio < v_e.chegada_em then
    raise exception 'O início não pode ser anterior à chegada.';
  end if;
  update public.execucoes_servico
  set inicio_em = p_inicio, fim_em = p_fim, motivo_correccao = trim(p_motivo)
  where id = p_id;
  insert into public.servico_historico (servico_id, utilizador_nome, accao)
  values (v_e.servico_id, public.nome_utilizador_actual(),
          'Tempos de execução corrigidos pela administração. Motivo: ' || trim(p_motivo));
end;
$$;
revoke execute on function public.corrigir_execucao(text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.corrigir_execucao(text, timestamptz, timestamptz, text) to authenticated;

create or replace function public.alterar_config_presenca(p_entrada time, p_saida time, p_tolerancia integer, p_janela integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_entrada is null or p_saida is null or p_saida <= p_entrada then
    raise exception 'A hora de saída deve ser posterior à de entrada.';
  end if;
  if p_tolerancia is null or p_tolerancia < 0 or p_tolerancia > 120 then
    raise exception 'A tolerância deve estar entre 0 e 120 minutos.';
  end if;
  if p_janela is null or p_janela < 0 or p_janela > 240 then
    raise exception 'A janela de início deve estar entre 0 e 240 minutos.';
  end if;
  update public.config_presenca
  set hora_entrada = p_entrada, hora_saida = p_saida, tolerancia_min = p_tolerancia,
      janela_inicio_min = p_janela, actualizado_em = now()
  where id = 1;
end;
$$;
revoke execute on function public.alterar_config_presenca(time, time, integer, integer) from public, anon;
grant execute on function public.alterar_config_presenca(time, time, integer, integer) to authenticated;

-- ===================== ADMINISTRAÇÃO: CONTAS =====================
create or replace function public.ligar_conta(p_user uuid, p_colaborador text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_nome text;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if not exists (select 1 from public.perfis where id = p_user) then
    raise exception 'Conta não encontrada.';
  end if;
  select nome into v_nome from public.colaboradores where id = p_colaborador;
  if not found then
    raise exception 'Seleccione o colaborador.';
  end if;
  if exists (select 1 from public.perfis where colaborador_id = p_colaborador and id <> p_user) then
    raise exception 'Este colaborador já está ligado a outra conta.';
  end if;
  update public.perfis
  set colaborador_id = p_colaborador,
      nome = case when nome = '' then v_nome else nome end
  where id = p_user;
end;
$$;
revoke execute on function public.ligar_conta(uuid, text) from public, anon;
grant execute on function public.ligar_conta(uuid, text) to authenticated;

create or replace function public.desligar_conta(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  update public.perfis set colaborador_id = null where id = p_user;
end;
$$;
revoke execute on function public.desligar_conta(uuid) from public, anon;
grant execute on function public.desligar_conta(uuid) to authenticated;

create or replace function public.definir_perfil_conta(p_user uuid, p_perfil text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'Não pode alterar o perfil da sua própria conta.';
  end if;
  if p_perfil not in ('administrador', 'gestao', 'operacional') then
    raise exception 'Perfil inválido.';
  end if;
  update public.perfis set perfil = p_perfil::public.perfil_utilizador where id = p_user;
end;
$$;
revoke execute on function public.definir_perfil_conta(uuid, text) from public, anon;
grant execute on function public.definir_perfil_conta(uuid, text) to authenticated;

create or replace function public.alternar_conta_activa(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'Não pode desactivar a sua própria conta.';
  end if;
  update public.perfis set activo = not activo where id = p_user;
end;
$$;
revoke execute on function public.alternar_conta_activa(uuid) from public, anon;
grant execute on function public.alternar_conta_activa(uuid) to authenticated;