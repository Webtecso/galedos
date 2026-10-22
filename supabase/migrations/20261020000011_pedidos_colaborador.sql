-- Galedos Gestão · Ronda 3b: pedidos de adiantamento, material e justificações

create sequence public.pedidos_seq;

create table public.pedidos_colaborador (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique default ('PED-' || lpad(nextval('public.pedidos_seq')::text, 4, '0')),
  colaborador_id text not null references public.colaboradores (id),
  tipo text not null check (tipo in ('Adiantamento', 'Material', 'Justificação')),
  valor numeric(14,2) check (valor is null or valor > 0),
  data_referencia date,
  descricao text not null check (length(trim(descricao)) > 0),
  estado text not null default 'Pendente' check (estado in ('Pendente', 'Aprovado', 'Recusado', 'Cancelado')),
  resposta text not null default '',
  respondido_por text not null default '',
  respondido_em timestamptz,
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now(),
  constraint pedido_coerente check (
    (tipo = 'Adiantamento' and valor is not null)
    or (tipo = 'Material' and valor is null)
    or (tipo = 'Justificação' and valor is null and data_referencia is not null)),
  constraint recusa_com_motivo check (estado <> 'Recusado' or length(trim(resposta)) > 0)
);
create index pedidos_colaborador_idx on public.pedidos_colaborador (colaborador_id, estado);
create unique index pedidos_um_adiantamento_pendente on public.pedidos_colaborador (colaborador_id)
  where tipo = 'Adiantamento' and estado = 'Pendente';

alter table public.pedidos_colaborador enable row level security;
create policy pedidos_ver on public.pedidos_colaborador for select to authenticated
  using (public.e_gestao() or colaborador_id = public.colaborador_actual());
revoke all on public.pedidos_colaborador from anon, authenticated;
grant select on public.pedidos_colaborador to authenticated;

-- Um pedido respondido ou cancelado já não muda; os dados do pedido nunca mudam
create or replace function public.pedidos_regras()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.estado <> 'Pendente' then
    raise exception 'Este pedido já foi respondido ou cancelado.';
  end if;
  if (to_jsonb(new) - 'estado' - 'resposta' - 'respondido_por' - 'respondido_em' - 'actualizado_em')
     is distinct from (to_jsonb(old) - 'estado' - 'resposta' - 'respondido_por' - 'respondido_em' - 'actualizado_em') then
    raise exception 'Os dados do pedido não podem ser alterados.';
  end if;
  return new;
end;
$$;
revoke execute on function public.pedidos_regras() from public, anon, authenticated;

create trigger pedidos_a_regras before update on public.pedidos_colaborador
  for each row execute function public.pedidos_regras();
create trigger pedidos_b_actualizado before update on public.pedidos_colaborador
  for each row execute function public.definir_actualizado_em();
create trigger pedidos_c_auditoria after insert or update or delete on public.pedidos_colaborador
  for each row execute function public.auditar();

create or replace function public.criar_pedido(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_tipo text := trim(coalesce(p ->> 'tipo', ''));
  v_desc text := left(trim(coalesce(p ->> 'descricao', '')), 1000);
  v_valor numeric := nullif(p ->> 'valor', '')::numeric;
  v_data date := nullif(p ->> 'data_referencia', '')::date;
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_id text;
begin
  if v_tipo not in ('Adiantamento', 'Material', 'Justificação') then
    raise exception 'Seleccione o tipo de pedido.';
  end if;
  if v_desc = '' then
    raise exception 'Descreva o pedido.';
  end if;
  if v_tipo = 'Adiantamento' then
    v_valor := round(v_valor, 2);
    if v_valor is null or v_valor <= 0 then
      raise exception 'Indique o valor do adiantamento.';
    end if;
    if exists (select 1 from public.pedidos_colaborador where colaborador_id = v_col and tipo = 'Adiantamento' and estado = 'Pendente') then
      raise exception 'Já tem um pedido de adiantamento pendente. Aguarde a resposta ou cancele-o.';
    end if;
    v_data := null;
  elsif v_tipo = 'Material' then
    v_valor := null;
    v_data := null;
  else
    v_valor := null;
    if v_data is null then
      raise exception 'Indique a data a que se refere a justificação.';
    end if;
    if v_data > v_hoje then
      raise exception 'A data não pode estar no futuro.';
    end if;
    if v_data < v_hoje - 60 then
      raise exception 'Só é possível justificar os últimos 60 dias.';
    end if;
  end if;
  insert into public.pedidos_colaborador (colaborador_id, tipo, valor, data_referencia, descricao)
  values (v_col, v_tipo, v_valor, v_data, v_desc)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.criar_pedido(jsonb) from public, anon;
grant execute on function public.criar_pedido(jsonb) to authenticated;

create or replace function public.cancelar_pedido(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_p record;
begin
  select * into v_p from public.pedidos_colaborador where id = p_id and colaborador_id = v_col for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_p.estado <> 'Pendente' then
    raise exception 'Só é possível cancelar pedidos pendentes.';
  end if;
  update public.pedidos_colaborador
  set estado = 'Cancelado', resposta = 'Cancelado pelo colaborador', respondido_em = now()
  where id = p_id;
end;
$$;
revoke execute on function public.cancelar_pedido(text) from public, anon;
grant execute on function public.cancelar_pedido(text) to authenticated;

create or replace function public.responder_pedido(p_id text, p_aprovar boolean, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p record;
  v_motivo text := left(trim(coalesce(p_motivo, '')), 500);
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_aprovar is null then
    raise exception 'Indique se o pedido é aprovado ou recusado.';
  end if;
  select * into v_p from public.pedidos_colaborador where id = p_id for update;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_p.colaborador_id = public.colaborador_actual() then
    raise exception 'Não pode responder ao seu próprio pedido.';
  end if;
  if v_p.tipo = 'Adiantamento' and not public.e_admin() then
    raise exception 'Só o administrador pode responder a pedidos de adiantamento.';
  end if;
  if v_p.estado <> 'Pendente' then
    raise exception 'Este pedido já foi respondido.';
  end if;
  if not p_aprovar and v_motivo = '' then
    raise exception 'Indique o motivo da recusa.';
  end if;
  update public.pedidos_colaborador
  set estado = case when p_aprovar then 'Aprovado' else 'Recusado' end,
      resposta = v_motivo,
      respondido_por = public.nome_utilizador_actual(),
      respondido_em = now()
  where id = p_id;
end;
$$;
revoke execute on function public.responder_pedido(text, boolean, text) from public, anon;
grant execute on function public.responder_pedido(text, boolean, text) to authenticated;