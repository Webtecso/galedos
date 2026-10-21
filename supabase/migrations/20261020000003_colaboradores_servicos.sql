-- Galedos Gestão · Base 2: colaboradores, catálogo, serviços e recebimentos

create or replace function public.nome_utilizador_actual()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select coalesce(nullif(nome, ''), email) from public.perfis where id = (select auth.uid())),
    'Sistema');
$$;
revoke execute on function public.nome_utilizador_actual() from public, anon;
grant execute on function public.nome_utilizador_actual() to authenticated;

-- ===================== COLABORADORES =====================
create sequence public.colaboradores_seq;

create table public.colaboradores (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique default ('COL-' || lpad(nextval('public.colaboradores_seq')::text, 4, '0')),
  nome text not null check (length(trim(nome)) > 0),
  funcao text not null check (length(trim(funcao)) > 0),
  telefone text not null check (length(regexp_replace(telefone, '\D', '', 'g')) >= 9),
  data_inicio date,
  modalidade text not null default 'Prestação de serviços'
    check (modalidade in ('Contrato de trabalho', 'Prestação de serviços', 'Colaboração ocasional')),
  contrato text not null default '',
  percentagem numeric(5,2) not null default 0 check (percentagem >= 0 and percentagem <= 100),
  estado text not null default 'Activo' check (estado in ('Activo', 'Inactivo', 'Suspenso')),
  observacoes text not null default '',
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);

alter table public.perfis add column colaborador_id text references public.colaboradores (id);

create or replace function public.colaborador_actual()
returns text language sql stable security definer set search_path = '' as $$
  select colaborador_id from public.perfis where id = (select auth.uid()) and activo;
$$;
revoke execute on function public.colaborador_actual() from public, anon;
grant execute on function public.colaborador_actual() to authenticated;

alter table public.colaboradores enable row level security;
create policy colaboradores_ver on public.colaboradores for select to authenticated
  using (public.e_gestao() or id = public.colaborador_actual());
create policy colaboradores_criar on public.colaboradores for insert to authenticated with check (public.e_admin());
create policy colaboradores_actualizar on public.colaboradores for update to authenticated
  using (public.e_admin()) with check (public.e_admin());
revoke all on public.colaboradores from anon;
revoke delete, truncate on public.colaboradores from authenticated;
grant usage, select on sequence public.colaboradores_seq to authenticated;

create trigger colaboradores_actualizado before update on public.colaboradores
  for each row execute function public.definir_actualizado_em();
create trigger colaboradores_auditoria after insert or update or delete on public.colaboradores
  for each row execute function public.auditar();

-- ===================== CATÁLOGO =====================
create sequence public.catalogo_seq;

create table public.catalogo_servicos (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique default ('SRV-' || lpad(nextval('public.catalogo_seq')::text, 3, '0')),
  nome text not null check (length(trim(nome)) > 0),
  descricao text not null default '',
  unidade text not null default 'unidade',
  preco numeric(14,2) not null check (preco >= 0),
  duracao_min integer not null check (duracao_min > 0),
  activo boolean not null default true,
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);

alter table public.catalogo_servicos enable row level security;
create policy catalogo_ver on public.catalogo_servicos for select to authenticated using (public.e_gestao());
create policy catalogo_criar on public.catalogo_servicos for insert to authenticated with check (public.e_admin());
create policy catalogo_actualizar on public.catalogo_servicos for update to authenticated
  using (public.e_admin()) with check (public.e_admin());
revoke all on public.catalogo_servicos from anon;
revoke delete, truncate on public.catalogo_servicos from authenticated;
grant usage, select on sequence public.catalogo_seq to authenticated;

create trigger catalogo_actualizado before update on public.catalogo_servicos
  for each row execute function public.definir_actualizado_em();
create trigger catalogo_auditoria after insert or update or delete on public.catalogo_servicos
  for each row execute function public.auditar();

-- ===================== SERVIÇOS =====================
create table public.contadores_servico (
  ano integer primary key,
  ultimo integer not null default 0
);
alter table public.contadores_servico enable row level security;
revoke all on public.contadores_servico from anon, authenticated;

create table public.servicos (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique,
  cliente_id text not null references public.clientes (id),
  catalogo_id text references public.catalogo_servicos (id),
  tipo_servico text not null check (length(trim(tipo_servico)) > 0),
  descricao text not null default '',
  quantidade numeric(12,2) not null check (quantidade > 0),
  preco_unitario numeric(14,2) not null check (preco_unitario >= 0),
  desconto numeric(14,2) not null default 0 check (desconto >= 0),
  total numeric(14,2) not null default 0,
  data date,
  hora time,
  duracao_min integer not null default 60 check (duracao_min > 0),
  local_execucao text not null default '',
  estado_operacional text not null default 'Pedido recebido' check (estado_operacional in (
    'Pedido recebido', 'A aguardar orçamento', 'Orçamento enviado', 'A aguardar confirmação',
    'Agendado', 'Em execução', 'Concluído', 'Cancelado')),
  motivo_cancelamento text not null default '',
  observacoes text not null default '',
  excepcao_conflito boolean not null default false,
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now(),
  constraint desconto_valido check (desconto <= quantidade * preco_unitario),
  constraint data_e_hora_juntas check ((data is null) = (hora is null)),
  constraint agenda_obrigatoria check (
    estado_operacional not in ('Agendado', 'Em execução', 'Concluído') or (data is not null and hora is not null)),
  constraint motivo_cancelamento_obrigatorio check (
    estado_operacional <> 'Cancelado' or length(trim(motivo_cancelamento)) > 0)
);

create index servicos_cliente_idx on public.servicos (cliente_id);
create index servicos_estado_idx on public.servicos (estado_operacional);
create index servicos_data_idx on public.servicos (data);

create table public.servico_colaboradores (
  servico_id text not null references public.servicos (id),
  colaborador_id text not null references public.colaboradores (id),
  primary key (servico_id, colaborador_id)
);
create index servico_colaboradores_colab_idx on public.servico_colaboradores (colaborador_id);

create table public.recebimentos (
  id text primary key default gen_random_uuid()::text,
  servico_id text not null references public.servicos (id),
  data date not null default ((now() at time zone 'Africa/Luanda')::date),
  valor numeric(14,2) not null check (valor > 0),
  meio text not null check (meio in ('Dinheiro', 'Transferência bancária', 'Multicaixa Express', 'Outro')),
  referencia text not null default '',
  utilizador_id uuid default auth.uid(),
  utilizador_nome text not null default 'Sistema',
  criado_em timestamptz not null default now()
);
create index recebimentos_servico_idx on public.recebimentos (servico_id);
create unique index recebimentos_sem_duplicados on public.recebimentos (servico_id, valor, meio, referencia)
  where referencia <> '';

create table public.servico_historico (
  id bigint generated always as identity primary key,
  servico_id text not null references public.servicos (id),
  data timestamptz not null default now(),
  utilizador_nome text not null default 'Sistema',
  accao text not null
);
create index servico_historico_servico_idx on public.servico_historico (servico_id);

-- Regras do serviço: código, total, estados, bloqueio e valor mínimo
create or replace function public.servicos_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ano integer;
  v_n integer;
  v_validos text[];
  v_recebido numeric;
begin
  new.total := greatest(0, round(new.quantidade * new.preco_unitario - new.desconto));

  if tg_op = 'INSERT' then
    if new.codigo is null or new.codigo = '' then
      v_ano := extract(year from (now() at time zone 'Africa/Luanda'))::integer;
      insert into public.contadores_servico (ano, ultimo) values (v_ano, 1)
        on conflict (ano) do update set ultimo = public.contadores_servico.ultimo + 1
        returning ultimo into v_n;
      new.codigo := 'GAL-' || v_ano::text || '-' || lpad(v_n::text, 4, '0');
    end if;
    if (select auth.uid()) is not null
       and new.estado_operacional not in ('Pedido recebido', 'Agendado') then
      raise exception 'Um serviço novo só pode começar como "Pedido recebido" ou "Agendado".';
    end if;
    return new;
  end if;

  if old.estado_operacional in ('Concluído', 'Cancelado') then
    raise exception 'O serviço está "%" e já não pode ser alterado. Use um ajuste autorizado.', old.estado_operacional;
  end if;
  if new.codigo <> old.codigo then
    raise exception 'O código do serviço não pode ser alterado.';
  end if;

  if new.estado_operacional <> old.estado_operacional then
    v_validos := case old.estado_operacional
      when 'Pedido recebido' then array['A aguardar orçamento', 'Agendado', 'Cancelado']
      when 'A aguardar orçamento' then array['Orçamento enviado', 'Cancelado']
      when 'Orçamento enviado' then array['A aguardar confirmação', 'Agendado', 'Cancelado']
      when 'A aguardar confirmação' then array['Agendado', 'Cancelado']
      when 'Agendado' then array['Em execução', 'Cancelado']
      when 'Em execução' then array['Concluído', 'Cancelado']
      else array[]::text[]
    end;
    if not (new.estado_operacional = any (v_validos)) then
      raise exception 'Não é possível passar de "%" para "%".', old.estado_operacional, new.estado_operacional;
    end if;
    if new.estado_operacional in ('Agendado', 'Em execução')
       and not exists (select 1 from public.servico_colaboradores where servico_id = new.id) then
      raise exception 'Atribua pelo menos um colaborador antes de agendar.';
    end if;
  end if;

  select coalesce(sum(valor), 0) into v_recebido from public.recebimentos where servico_id = new.id;
  if new.total < v_recebido then
    raise exception 'O valor total não pode ficar abaixo do valor já recebido (% Kz).', trim_scale(v_recebido)::text;
  end if;
  return new;
end;
$$;
revoke execute on function public.servicos_regras() from public, anon, authenticated;

create trigger servicos_b_regras before insert or update on public.servicos
  for each row execute function public.servicos_regras();
create trigger servicos_c_actualizado before update on public.servicos
  for each row execute function public.definir_actualizado_em();

-- Histórico automático do serviço
create or replace function public.servicos_historico_fn()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_linhas text[] := array[]::text[];
  v_l text;
begin
  if tg_op = 'INSERT' then
    v_linhas := array_append(v_linhas, 'Serviço criado (estado: ' || new.estado_operacional || ')');
  else
    if new.estado_operacional <> old.estado_operacional then
      v_linhas := array_append(v_linhas,
        'Estado alterado de "' || old.estado_operacional || '" para "' || new.estado_operacional || '"'
        || case when new.estado_operacional = 'Cancelado' then '. Motivo: ' || new.motivo_cancelamento else '' end);
    end if;
    if new.quantidade <> old.quantidade then
      v_linhas := array_append(v_linhas, 'Alterado: quantidade de ' || trim_scale(old.quantidade)::text || ' para ' || trim_scale(new.quantidade)::text);
    end if;
    if new.preco_unitario <> old.preco_unitario then
      v_linhas := array_append(v_linhas, 'Alterado: preço unitário de ' || trim_scale(old.preco_unitario)::text || ' Kz para ' || trim_scale(new.preco_unitario)::text || ' Kz');
    end if;
    if new.desconto <> old.desconto then
      v_linhas := array_append(v_linhas, 'Alterado: desconto de ' || trim_scale(old.desconto)::text || ' Kz para ' || trim_scale(new.desconto)::text || ' Kz');
    end if;
    if new.data is distinct from old.data or new.hora is distinct from old.hora then
      v_linhas := array_append(v_linhas,
        'Alterado: agendamento de '
        || coalesce(to_char(old.data::timestamp, 'DD/MM/YYYY') || ' ' || left(old.hora::text, 5), 'sem data')
        || ' para '
        || coalesce(to_char(new.data::timestamp, 'DD/MM/YYYY') || ' ' || left(new.hora::text, 5), 'sem data'));
    end if;
    if new.excepcao_conflito and not old.excepcao_conflito then
      v_linhas := array_append(v_linhas, 'Excepção de conflito de horário autorizada');
    end if;
    if cardinality(v_linhas) = 0
       and (to_jsonb(new) - 'actualizado_em') is distinct from (to_jsonb(old) - 'actualizado_em') then
      v_linhas := array_append(v_linhas, 'Dados do serviço actualizados');
    end if;
  end if;

  foreach v_l in array v_linhas loop
    insert into public.servico_historico (servico_id, utilizador_nome, accao)
    values (new.id, public.nome_utilizador_actual(), v_l);
  end loop;
  return new;
end;
$$;
revoke execute on function public.servicos_historico_fn() from public, anon, authenticated;

create trigger servicos_d_historico after insert or update on public.servicos
  for each row execute function public.servicos_historico_fn();
create trigger servicos_e_auditoria after insert or update or delete on public.servicos
  for each row execute function public.auditar();

-- Recebimentos: nunca excedem o saldo
create or replace function public.recebimentos_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
  v_total numeric;
  v_recebido numeric;
begin
  select estado_operacional, total into v_estado, v_total
  from public.servicos where id = new.servico_id for update;
  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_estado = 'Cancelado' then
    raise exception 'Não é possível registar pagamentos num serviço cancelado.';
  end if;
  select coalesce(sum(valor), 0) into v_recebido from public.recebimentos where servico_id = new.servico_id;
  if new.valor > v_total - v_recebido then
    raise exception 'O valor excede o saldo pendente (% Kz).', trim_scale(greatest(v_total - v_recebido, 0))::text;
  end if;
  new.utilizador_nome := public.nome_utilizador_actual();
  return new;
end;
$$;
revoke execute on function public.recebimentos_regras() from public, anon, authenticated;

create or replace function public.recebimentos_historico_fn()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.servico_historico (servico_id, utilizador_nome, accao)
  values (new.servico_id, new.utilizador_nome,
          'Recebimento registado: ' || trim_scale(new.valor)::text || ' Kz (' || new.meio || ')');
  return new;
end;
$$;
revoke execute on function public.recebimentos_historico_fn() from public, anon, authenticated;

create trigger recebimentos_a_regras before insert on public.recebimentos
  for each row execute function public.recebimentos_regras();
create trigger recebimentos_b_historico after insert on public.recebimentos
  for each row execute function public.recebimentos_historico_fn();
create trigger recebimentos_c_auditoria after insert or update or delete on public.recebimentos
  for each row execute function public.auditar();

-- Permissões (RLS)
alter table public.servicos enable row level security;
create policy servicos_ver on public.servicos for select to authenticated using (public.e_gestao());
create policy servicos_ver_operacional on public.servicos for select to authenticated
  using (exists (select 1 from public.servico_colaboradores sc
                 where sc.servico_id = servicos.id and sc.colaborador_id = public.colaborador_actual()));
create policy servicos_criar on public.servicos for insert to authenticated with check (public.e_gestao());
create policy servicos_actualizar on public.servicos for update to authenticated
  using (public.e_gestao()) with check (public.e_gestao());
revoke all on public.servicos from anon;
revoke delete, truncate on public.servicos from authenticated;

alter table public.servico_colaboradores enable row level security;
create policy servico_colab_ver on public.servico_colaboradores for select to authenticated
  using (public.e_gestao() or colaborador_id = public.colaborador_actual());
revoke all on public.servico_colaboradores from anon, authenticated;
grant select on public.servico_colaboradores to authenticated;

alter table public.recebimentos enable row level security;
create policy recebimentos_ver on public.recebimentos for select to authenticated using (public.e_gestao());
create policy recebimentos_criar on public.recebimentos for insert to authenticated with check (public.e_gestao());
revoke all on public.recebimentos from anon, authenticated;
grant select, insert on public.recebimentos to authenticated;

alter table public.servico_historico enable row level security;
create policy servico_historico_ver on public.servico_historico for select to authenticated using (public.e_gestao());
revoke all on public.servico_historico from anon, authenticated;
grant select on public.servico_historico to authenticated;

-- Criar / actualizar serviço e equipa numa única operação atómica
create or replace function public.guardar_servico(p_id text, p jsonb, p_equipa text[])
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
  v_estado text;
  v_antes text[];
  v_depois text[];
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;

  select coalesce(array_agg(distinct x order by x), array[]::text[]) into v_depois
  from unnest(coalesce(p_equipa, array[]::text[])) as x;

  if p_id is null then
    insert into public.servicos (
      cliente_id, catalogo_id, tipo_servico, descricao, quantidade, preco_unitario, desconto,
      data, hora, duracao_min, local_execucao, estado_operacional, observacoes, excepcao_conflito)
    values (
      p ->> 'cliente_id', nullif(p ->> 'catalogo_id', ''), p ->> 'tipo_servico',
      coalesce(p ->> 'descricao', ''), (p ->> 'quantidade')::numeric, (p ->> 'preco_unitario')::numeric,
      coalesce((p ->> 'desconto')::numeric, 0), nullif(p ->> 'data', '')::date, nullif(p ->> 'hora', '')::time,
      (p ->> 'duracao_min')::integer, coalesce(p ->> 'local_execucao', ''),
      coalesce(nullif(p ->> 'estado_operacional', ''), 'Pedido recebido'),
      coalesce(p ->> 'observacoes', ''), coalesce((p ->> 'excepcao_conflito')::boolean, false))
    returning id into v_id;
  else
    update public.servicos set
      cliente_id = p ->> 'cliente_id',
      catalogo_id = nullif(p ->> 'catalogo_id', ''),
      tipo_servico = p ->> 'tipo_servico',
      descricao = coalesce(p ->> 'descricao', ''),
      quantidade = (p ->> 'quantidade')::numeric,
      preco_unitario = (p ->> 'preco_unitario')::numeric,
      desconto = coalesce((p ->> 'desconto')::numeric, 0),
      data = nullif(p ->> 'data', '')::date,
      hora = nullif(p ->> 'hora', '')::time,
      duracao_min = (p ->> 'duracao_min')::integer,
      local_execucao = coalesce(p ->> 'local_execucao', ''),
      observacoes = coalesce(p ->> 'observacoes', ''),
      excepcao_conflito = coalesce((p ->> 'excepcao_conflito')::boolean, false)
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Serviço não encontrado.';
    end if;
  end if;

  select coalesce(array_agg(colaborador_id order by colaborador_id), array[]::text[]) into v_antes
  from public.servico_colaboradores where servico_id = v_id;

  if v_antes is distinct from v_depois then
    if exists (select 1 from public.colaboradores c
               where c.id = any (v_depois) and c.estado <> 'Activo' and not (c.id = any (v_antes))) then
      raise exception 'Só é possível atribuir colaboradores activos.';
    end if;
    delete from public.servico_colaboradores where servico_id = v_id;
    insert into public.servico_colaboradores (servico_id, colaborador_id)
    select v_id, unnest(v_depois);
    if p_id is not null then
      insert into public.servico_historico (servico_id, utilizador_nome, accao)
      values (v_id, public.nome_utilizador_actual(), 'Alterado: equipa atribuída');
    end if;
  end if;

  select estado_operacional into v_estado from public.servicos where id = v_id;
  if v_estado in ('Agendado', 'Em execução') and cardinality(v_depois) = 0 then
    raise exception 'Para agendar, atribua pelo menos um colaborador.';
  end if;

  return v_id;
end;
$$;
revoke execute on function public.guardar_servico(text, jsonb, text[]) from public, anon;
grant execute on function public.guardar_servico(text, jsonb, text[]) to authenticated;