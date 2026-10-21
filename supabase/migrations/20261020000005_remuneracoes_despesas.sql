-- Galedos Gestão · Base 3: remunerações, pagamentos a colaboradores e despesas

-- ===================== CATEGORIAS DE DESPESA =====================
create table public.categorias_despesa (
  id text primary key default gen_random_uuid()::text,
  nome text not null unique check (length(trim(nome)) > 0),
  criado_em timestamptz not null default now()
);
create unique index categorias_despesa_nome_ci on public.categorias_despesa (lower(nome));

alter table public.categorias_despesa enable row level security;
create policy categorias_ver on public.categorias_despesa for select to authenticated using (public.e_admin());
create policy categorias_criar on public.categorias_despesa for insert to authenticated with check (public.e_admin());
revoke all on public.categorias_despesa from anon;
revoke update, delete, truncate on public.categorias_despesa from authenticated;

create trigger categorias_auditoria after insert or update or delete on public.categorias_despesa
  for each row execute function public.auditar();

insert into public.categorias_despesa (nome) values
  ('Produtos de limpeza'), ('Transporte'), ('Combustível'), ('Manutenção'), ('Equipamentos'),
  ('Publicidade'), ('Comunicações'), ('Serviços administrativos'), ('Outras despesas');

-- ===================== DESPESAS =====================
create sequence public.despesas_seq;

create table public.despesas (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique default ('DSP-' || lpad(nextval('public.despesas_seq')::text, 4, '0')),
  data date not null,
  categoria text not null references public.categorias_despesa (nome),
  descricao text not null check (length(trim(descricao)) > 0),
  valor numeric(14,2) not null check (valor > 0),
  fornecedor text not null default '',
  meio text not null check (meio in ('Dinheiro', 'Transferência bancária', 'Multicaixa Express', 'Outro')),
  referencia text not null default '',
  estado text not null check (estado in ('Pago', 'Por pagar', 'Anulada')),
  observacoes text not null default '',
  motivo_anulacao text not null default '',
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now(),
  constraint motivo_anulacao_obrigatorio check (estado <> 'Anulada' or length(trim(motivo_anulacao)) > 0)
);
create index despesas_data_idx on public.despesas (data);

create or replace function public.despesas_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.estado not in ('Pago', 'Por pagar') then
      raise exception 'Uma despesa nova só pode ser registada como "Pago" ou "Por pagar".';
    end if;
    new.motivo_anulacao := '';
    return new;
  end if;

  if old.estado = 'Anulada' then
    raise exception 'A despesa está anulada e já não pode ser alterada.';
  end if;
  if (to_jsonb(new) - 'estado' - 'motivo_anulacao' - 'actualizado_em')
     is distinct from (to_jsonb(old) - 'estado' - 'motivo_anulacao' - 'actualizado_em') then
    raise exception 'Os dados de uma despesa registada não podem ser editados. Anule-a com motivo e registe uma nova.';
  end if;

  if new.estado <> old.estado then
    if new.estado = 'Pago' and old.estado = 'Por pagar' then
      null;
    elsif new.estado = 'Anulada' then
      if length(trim(new.motivo_anulacao)) = 0 then
        raise exception 'O motivo da anulação é obrigatório.';
      end if;
    else
      raise exception 'Não é possível passar de "%" para "%".', old.estado, new.estado;
    end if;
  elsif new.motivo_anulacao is distinct from old.motivo_anulacao then
    raise exception 'O motivo só pode ser indicado ao anular a despesa.';
  end if;
  return new;
end;
$$;
revoke execute on function public.despesas_regras() from public, anon, authenticated;

alter table public.despesas enable row level security;
create policy despesas_ver on public.despesas for select to authenticated using (public.e_admin());
create policy despesas_criar on public.despesas for insert to authenticated with check (public.e_admin());
create policy despesas_actualizar on public.despesas for update to authenticated
  using (public.e_admin()) with check (public.e_admin());
revoke all on public.despesas from anon;
revoke delete, truncate on public.despesas from authenticated;
grant usage, select on sequence public.despesas_seq to authenticated;

create trigger despesas_a_regras before insert or update on public.despesas
  for each row execute function public.despesas_regras();
create trigger despesas_b_actualizado before update on public.despesas
  for each row execute function public.definir_actualizado_em();
create trigger despesas_c_auditoria after insert or update or delete on public.despesas
  for each row execute function public.auditar();

-- ===================== CONFIGURAÇÃO DAS REMUNERAÇÕES (versionada) =====================
create table public.config_remuneracao (
  id bigint generated always as identity primary key,
  percentagem_equipa numeric(5,2) not null check (percentagem_equipa >= 0 and percentagem_equipa <= 100),
  modalidade text not null check (modalidade in ('Divisão igual', 'Percentagens individuais', 'Quotas por serviço')),
  entrada_em_vigor date not null,
  accao text not null,
  utilizador_nome text not null default 'Sistema',
  criado_em timestamptz not null default now()
);

alter table public.config_remuneracao enable row level security;
create policy config_ver on public.config_remuneracao for select to authenticated using (public.e_admin());
revoke all on public.config_remuneracao from anon, authenticated;
grant select on public.config_remuneracao to authenticated;

create trigger config_auditoria after insert or update or delete on public.config_remuneracao
  for each row execute function public.auditar();

insert into public.config_remuneracao (percentagem_equipa, modalidade, entrada_em_vigor, accao)
values (40, 'Divisão igual', '2026-01-01', 'Configuração inicial: equipa 40% (Divisão igual).');

-- ===================== PERÍODOS FECHADOS =====================
create table public.periodos_remuneracao (
  id text primary key default gen_random_uuid()::text,
  periodo text not null unique check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  fechado_em timestamptz not null default now(),
  fechado_por text not null default 'Sistema'
);

alter table public.periodos_remuneracao enable row level security;
create policy periodos_ver on public.periodos_remuneracao for select to authenticated using (public.e_admin());
revoke all on public.periodos_remuneracao from anon, authenticated;
grant select on public.periodos_remuneracao to authenticated;

create trigger periodos_auditoria after insert or update or delete on public.periodos_remuneracao
  for each row execute function public.auditar();

-- ===================== QUOTAS POR SERVIÇO =====================
create table public.quotas_servico (
  id text primary key default gen_random_uuid()::text,
  servico_id text not null references public.servicos (id),
  colaborador_id text not null references public.colaboradores (id),
  quota numeric(6,2) not null check (quota >= 0 and quota <= 100),
  definido_em timestamptz not null default now(),
  definido_por text not null default 'Sistema',
  unique (servico_id, colaborador_id)
);

alter table public.quotas_servico enable row level security;
create policy quotas_ver on public.quotas_servico for select to authenticated using (public.e_admin());
revoke all on public.quotas_servico from anon, authenticated;
grant select on public.quotas_servico to authenticated;

create trigger quotas_auditoria after insert or update or delete on public.quotas_servico
  for each row execute function public.auditar();

-- ===================== REMUNERAÇÕES =====================
create table public.remuneracoes (
  id text primary key default gen_random_uuid()::text,
  tipo text not null check (tipo in ('Serviço', 'Ajuste')),
  servico_id text references public.servicos (id),
  servico_codigo text not null default '—',
  recebimento_id text references public.recebimentos (id),
  colaborador_id text not null references public.colaboradores (id),
  valor_elegivel numeric(14,2) not null default 0,
  percentagem numeric(10,6) not null default 0,
  regra text not null default '',
  valor numeric(14,2) not null,
  data date not null default ((now() at time zone 'Africa/Luanda')::date),
  periodo text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  aprovada boolean not null default false,
  motivo text not null default '',
  criado_em timestamptz not null default now(),
  constraint remuneracao_coerente check (
    (tipo = 'Serviço' and servico_id is not null and recebimento_id is not null and valor >= 0)
    or (tipo = 'Ajuste' and valor <> 0 and length(trim(motivo)) > 0))
);
create unique index remuneracoes_sem_duplicados on public.remuneracoes (recebimento_id, colaborador_id)
  where recebimento_id is not null;
create index remuneracoes_colaborador_idx on public.remuneracoes (colaborador_id);
create index remuneracoes_periodo_idx on public.remuneracoes (periodo);

create or replace function public.remuneracoes_regras()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.periodos_remuneracao where periodo = new.periodo) then
      raise exception 'O período % está fechado.', new.periodo;
    end if;
    if new.tipo = 'Serviço' and new.aprovada then
      raise exception 'Uma remuneração de serviço só pode ser aprovada depois de apurada.';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - 'aprovada') is distinct from (to_jsonb(old) - 'aprovada') then
    raise exception 'Uma remuneração apurada não pode ser alterada. Use um ajuste autorizado.';
  end if;
  if old.aprovada and not new.aprovada then
    raise exception 'Uma remuneração aprovada não pode voltar atrás. Use um ajuste autorizado.';
  end if;
  return new;
end;
$$;
revoke execute on function public.remuneracoes_regras() from public, anon, authenticated;

alter table public.remuneracoes enable row level security;
create policy remuneracoes_ver on public.remuneracoes for select to authenticated
  using (public.e_admin() or colaborador_id = public.colaborador_actual());
revoke all on public.remuneracoes from anon, authenticated;
grant select on public.remuneracoes to authenticated;

create trigger remuneracoes_a_regras before insert or update on public.remuneracoes
  for each row execute function public.remuneracoes_regras();
create trigger remuneracoes_c_auditoria after insert or update or delete on public.remuneracoes
  for each row execute function public.auditar();

-- ===================== PAGAMENTOS A COLABORADORES =====================
create table public.pagamentos_colaboradores (
  id text primary key default gen_random_uuid()::text,
  colaborador_id text not null references public.colaboradores (id),
  tipo text not null check (tipo in ('Pagamento', 'Adiantamento')),
  data date not null default ((now() at time zone 'Africa/Luanda')::date),
  valor numeric(14,2) not null check (valor > 0),
  meio text not null check (meio in ('Dinheiro', 'Transferência bancária', 'Multicaixa Express', 'Outro')),
  referencia text not null default '',
  utilizador_id uuid default auth.uid(),
  utilizador_nome text not null default 'Sistema',
  criado_em timestamptz not null default now()
);
create index pagamentos_colab_idx on public.pagamentos_colaboradores (colaborador_id);
create unique index pagamentos_colab_sem_duplicados
  on public.pagamentos_colaboradores (colaborador_id, valor, meio, referencia) where referencia <> '';

alter table public.pagamentos_colaboradores enable row level security;
create policy pagamentos_colab_ver on public.pagamentos_colaboradores for select to authenticated
  using (public.e_admin() or colaborador_id = public.colaborador_actual());
revoke all on public.pagamentos_colaboradores from anon, authenticated;
grant select on public.pagamentos_colaboradores to authenticated;

create trigger pagamentos_colab_auditoria after insert or update or delete on public.pagamentos_colaboradores
  for each row execute function public.auditar();

-- ===================== DISTRIBUIÇÃO (função interna) =====================
create or replace function public.distribuir_remuneracao(
  p_valor numeric, p_equipa text[], p_modalidade text, p_pct numeric, p_servico text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  n integer := coalesce(cardinality(p_equipa), 0);
  v_total numeric;
  v_base numeric[] := array[]::numeric[];
  v_pcts numeric[] := array[]::numeric[];
  v_resto numeric;
  v_soma numeric;
  v_quota numeric;
  v_nomes text;
  v_count integer;
  i integer;
begin
  if n = 0 then
    return jsonb_build_object('aviso', 'sem equipa atribuída');
  end if;

  if p_modalidade = 'Divisão igual' then
    v_total := round(p_valor * p_pct / 100);
    v_resto := v_total - floor(v_total / n) * n;
    for i in 1..n loop
      v_base := array_append(v_base, floor(v_total / n) + case when i <= v_resto then 1 else 0 end);
      v_pcts := array_append(v_pcts, p_pct / n);
    end loop;
    return jsonb_build_object(
      'regra', 'Divisão igual · equipa ' || trim_scale(p_pct)::text || '%',
      'valores', to_jsonb(v_base), 'percentagens', to_jsonb(v_pcts));
  end if;

  if p_modalidade = 'Quotas por serviço' then
    select count(*), coalesce(sum(quota), 0) into v_count, v_soma
    from public.quotas_servico where servico_id = p_servico;
    if v_count = 0 then
      return jsonb_build_object('aviso', 'modalidade Quotas por serviço sem quotas definidas (Remunerações > Quotas por serviço)');
    end if;
    if v_count <> n or exists (
      select 1 from unnest(p_equipa) e
      where not exists (select 1 from public.quotas_servico q where q.servico_id = p_servico and q.colaborador_id = e)) then
      return jsonb_build_object('aviso', 'as quotas definidas já não correspondem à equipa actual');
    end if;
    if abs(v_soma - 100) > 0.01 then
      return jsonb_build_object('aviso', 'as quotas somam ' || trim_scale(v_soma)::text || '% (devem somar 100%)');
    end if;
    v_total := round(p_valor * p_pct / 100);
    for i in 1..n loop
      select quota into v_quota from public.quotas_servico
      where servico_id = p_servico and colaborador_id = p_equipa[i];
      v_base := array_append(v_base, floor(v_total * v_quota / v_soma));
      v_pcts := array_append(v_pcts, p_pct * v_quota / v_soma);
    end loop;
    select v_total - sum(x) into v_resto from unnest(v_base) x;
    i := 1;
    while v_resto > 0 loop
      v_base[i] := v_base[i] + 1;
      v_resto := v_resto - 1;
      i := (i % n) + 1;
    end loop;
    return jsonb_build_object(
      'regra', 'Quotas por serviço · equipa ' || trim_scale(p_pct)::text || '%',
      'valores', to_jsonb(v_base), 'percentagens', to_jsonb(v_pcts));
  end if;

  -- Percentagens individuais
  select string_agg(c.nome, ', ' order by c.nome) into v_nomes
  from public.colaboradores c where c.id = any (p_equipa) and not (c.percentagem > 0);
  if v_nomes is not null then
    return jsonb_build_object('aviso', 'sem percentagem individual: ' || v_nomes);
  end if;
  select coalesce(sum(c.percentagem), 0) into v_soma from public.colaboradores c where c.id = any (p_equipa);
  if v_soma > 100 then
    return jsonb_build_object('aviso', 'a soma das percentagens da equipa (' || trim_scale(v_soma)::text || '%) excede 100%');
  end if;
  for i in 1..n loop
    select percentagem into v_quota from public.colaboradores where id = p_equipa[i];
    v_base := array_append(v_base, round(p_valor * v_quota / 100));
    v_pcts := array_append(v_pcts, v_quota);
  end loop;
  return jsonb_build_object('regra', 'Percentagens individuais', 'valores', to_jsonb(v_base), 'percentagens', to_jsonb(v_pcts));
end;
$$;
revoke execute on function public.distribuir_remuneracao(numeric, text[], text, numeric, text) from public, anon, authenticated;

-- ===================== APURAMENTO =====================
create or replace function public.apurar_remuneracoes()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cfg record;
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_periodo text := to_char((now() at time zone 'Africa/Luanda')::date, 'YYYY-MM');
  v_meses text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  rec record;
  v_equipa text[];
  v_d jsonb;
  v_n integer;
  i integer;
  v_criadas integer := 0;
  v_aguardam integer := 0;
  v_avisos text[] := array[]::text[];
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  perform pg_advisory_xact_lock(hashtext('apurar_remuneracoes'));

  if exists (select 1 from public.periodos_remuneracao where periodo = v_periodo) then
    raise exception 'O período % % está fechado. Use um ajuste para correcções.',
      v_meses[extract(month from v_hoje)::integer], extract(year from v_hoje)::integer;
  end if;

  select * into v_cfg from public.config_remuneracao order by id desc limit 1;
  if not found then
    raise exception 'Configuração de remuneração em falta.';
  end if;

  for rec in
    select r.id as rec_id, r.valor, s.id as servico_id, s.codigo, s.estado_operacional
    from public.recebimentos r
    join public.servicos s on s.id = r.servico_id
    where not exists (select 1 from public.remuneracoes m where m.recebimento_id = r.id)
    order by r.criado_em, r.id
  loop
    if rec.estado_operacional <> 'Concluído' then
      if rec.estado_operacional <> 'Cancelado' then
        v_aguardam := v_aguardam + 1;
      end if;
      continue;
    end if;

    select coalesce(array_agg(sc.colaborador_id order by sc.colaborador_id), array[]::text[]) into v_equipa
    from public.servico_colaboradores sc where sc.servico_id = rec.servico_id;
    v_n := cardinality(v_equipa);

    v_d := public.distribuir_remuneracao(rec.valor, v_equipa, v_cfg.modalidade, v_cfg.percentagem_equipa, rec.servico_id);
    if (v_d ->> 'aviso') is not null then
      v_avisos := array_append(v_avisos, rec.codigo || ': ' || (v_d ->> 'aviso'));
      continue;
    end if;

    for i in 1..v_n loop
      insert into public.remuneracoes (
        tipo, servico_id, servico_codigo, recebimento_id, colaborador_id,
        valor_elegivel, percentagem, regra, valor, data, periodo)
      values (
        'Serviço', rec.servico_id, rec.codigo, rec.rec_id, v_equipa[i],
        rec.valor, (v_d -> 'percentagens' ->> (i - 1))::numeric, v_d ->> 'regra',
        (v_d -> 'valores' ->> (i - 1))::numeric, v_hoje, v_periodo);
      v_criadas := v_criadas + 1;
    end loop;
  end loop;

  if v_aguardam > 0 then
    v_avisos := array_append(v_avisos, v_aguardam::text || ' recebimento(s) aguardam a conclusão do respectivo serviço.');
  end if;
  return jsonb_build_object('criadas', v_criadas, 'avisos', to_jsonb(v_avisos));
end;
$$;
revoke execute on function public.apurar_remuneracoes() from public, anon;
grant execute on function public.apurar_remuneracoes() to authenticated;

-- ===================== APROVAR / FECHAR =====================
create or replace function public.aprovar_periodo(p_periodo text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  update public.remuneracoes set aprovada = true where periodo = p_periodo and not aprovada;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Não há remunerações por aprovar neste período.';
  end if;
  return v_n;
end;
$$;
revoke execute on function public.aprovar_periodo(text) from public, anon;
grant execute on function public.aprovar_periodo(text) to authenticated;

create or replace function public.fechar_periodo(p_periodo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_periodo is null or p_periodo !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Período inválido.';
  end if;
  if exists (select 1 from public.periodos_remuneracao where periodo = p_periodo) then
    raise exception 'Este período já está fechado.';
  end if;
  if exists (select 1 from public.remuneracoes where periodo = p_periodo and not aprovada) then
    raise exception 'Aprove todas as remunerações do período antes de o fechar.';
  end if;
  insert into public.periodos_remuneracao (periodo, fechado_por)
  values (p_periodo, public.nome_utilizador_actual());
end;
$$;
revoke execute on function public.fechar_periodo(text) from public, anon;
grant execute on function public.fechar_periodo(text) to authenticated;

-- ===================== AJUSTES =====================
create or replace function public.registar_ajuste(p_colaborador text, p_valor numeric, p_motivo text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_p date := date_trunc('month', (now() at time zone 'Africa/Luanda'))::date;
  v_valor numeric;
  v_id text;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if not exists (select 1 from public.colaboradores where id = p_colaborador) then
    raise exception 'Seleccione o colaborador.';
  end if;
  v_valor := round(coalesce(p_valor, 0));
  if v_valor = 0 then
    raise exception 'Indique um valor diferente de zero (negativo para deduzir).';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'O motivo do ajuste é obrigatório.';
  end if;
  loop
    exit when not exists (select 1 from public.periodos_remuneracao where periodo = to_char(v_p, 'YYYY-MM'));
    v_p := (v_p + interval '1 month')::date;
  end loop;
  insert into public.remuneracoes (tipo, servico_codigo, colaborador_id, regra, valor, data, periodo, aprovada, motivo)
  values ('Ajuste', '—', p_colaborador, 'Ajuste autorizado', v_valor, v_hoje, to_char(v_p, 'YYYY-MM'), true, trim(p_motivo))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.registar_ajuste(text, numeric, text) from public, anon;
grant execute on function public.registar_ajuste(text, numeric, text) to authenticated;

-- ===================== PAGAMENTOS =====================
create or replace function public.registar_pagamento_colaborador(
  p_colaborador text, p_tipo text, p_valor numeric, p_meio text, p_referencia text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_aprovado numeric;
  v_pago numeric;
  v_saldo numeric;
  v_valor numeric;
  v_ref text := trim(coalesce(p_referencia, ''));
  v_id text;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  perform 1 from public.colaboradores where id = p_colaborador for update;
  if not found then
    raise exception 'Seleccione o colaborador.';
  end if;
  if p_tipo not in ('Pagamento', 'Adiantamento') then
    raise exception 'Tipo de pagamento inválido.';
  end if;
  v_valor := round(coalesce(p_valor, 0), 2);
  if v_valor <= 0 then
    raise exception 'Indique um valor superior a zero.';
  end if;

  select coalesce(sum(valor), 0) into v_aprovado
  from public.remuneracoes where colaborador_id = p_colaborador and aprovada;
  select coalesce(sum(valor), 0) into v_pago
  from public.pagamentos_colaboradores where colaborador_id = p_colaborador;
  v_saldo := v_aprovado - v_pago;

  if p_tipo = 'Pagamento' and v_valor > greatest(0, v_saldo) then
    raise exception 'O valor excede o saldo aprovado por pagar (% Kz). Para valores antes da aprovação, use "Adiantamento".',
      trim_scale(greatest(0, v_saldo))::text;
  end if;
  if v_ref <> '' and exists (
    select 1 from public.pagamentos_colaboradores
    where colaborador_id = p_colaborador and valor = v_valor and meio = p_meio and referencia = v_ref) then
    raise exception 'Já existe um pagamento com o mesmo valor, meio e referência.';
  end if;

  insert into public.pagamentos_colaboradores (colaborador_id, tipo, valor, meio, referencia, utilizador_nome)
  values (p_colaborador, p_tipo, v_valor, p_meio, v_ref, public.nome_utilizador_actual())
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.registar_pagamento_colaborador(text, text, numeric, text, text) from public, anon;
grant execute on function public.registar_pagamento_colaborador(text, text, numeric, text, text) to authenticated;

-- ===================== CONFIGURAÇÃO =====================
create or replace function public.alterar_config_remuneracao(p_percentagem numeric, p_modalidade text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actual record;
  v_pct numeric;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_percentagem is null or p_percentagem < 0 or p_percentagem > 100 then
    raise exception 'A percentagem da equipa deve estar entre 0 e 100.';
  end if;
  if p_modalidade not in ('Divisão igual', 'Percentagens individuais', 'Quotas por serviço') then
    raise exception 'Modalidade inválida.';
  end if;
  v_pct := round(p_percentagem, 2);
  select * into v_actual from public.config_remuneracao order by id desc limit 1;
  if v_actual.percentagem_equipa = v_pct and v_actual.modalidade = p_modalidade then
    raise exception 'Não há alterações a guardar.';
  end if;
  insert into public.config_remuneracao (percentagem_equipa, modalidade, entrada_em_vigor, accao, utilizador_nome)
  values (
    v_pct, p_modalidade, (now() at time zone 'Africa/Luanda')::date,
    'Configuração alterada: equipa ' || trim_scale(v_actual.percentagem_equipa)::text || '% (' || v_actual.modalidade
      || ') para ' || trim_scale(v_pct)::text || '% (' || p_modalidade || '). Aplica-se apenas a apuramentos futuros.',
    public.nome_utilizador_actual());
end;
$$;
revoke execute on function public.alterar_config_remuneracao(numeric, text) from public, anon;
grant execute on function public.alterar_config_remuneracao(numeric, text) to authenticated;

-- ===================== QUOTAS =====================
create or replace function public.definir_quotas(p_servico text, p_quotas jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
  v_equipa text[];
  v_id text;
  v_q numeric;
  v_soma numeric := 0;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  select estado_operacional into v_estado from public.servicos where id = p_servico for update;
  if not found then
    raise exception 'Seleccione o serviço.';
  end if;
  if v_estado = 'Cancelado' then
    raise exception 'O serviço está cancelado.';
  end if;
  select array_agg(colaborador_id order by colaborador_id) into v_equipa
  from public.servico_colaboradores where servico_id = p_servico;
  if v_equipa is null then
    raise exception 'O serviço não tem equipa atribuída.';
  end if;
  if exists (select 1 from public.remuneracoes where servico_id = p_servico and tipo = 'Serviço') then
    raise exception 'Este serviço já tem remunerações apuradas; as quotas não podem ser alteradas. Use um ajuste.';
  end if;

  foreach v_id in array v_equipa loop
    if jsonb_typeof(p_quotas -> v_id) is distinct from 'number' then
      raise exception 'Indique uma quota válida (0 ou mais) para cada colaborador.';
    end if;
    v_q := round((p_quotas ->> v_id)::numeric, 2);
    if v_q < 0 or v_q > 100 then
      raise exception 'Indique uma quota válida (0 ou mais) para cada colaborador.';
    end if;
    v_soma := v_soma + v_q;
  end loop;
  if abs(v_soma - 100) > 0.01 then
    raise exception '%', 'As quotas somam ' || trim_scale(v_soma)::text || '%; devem somar exactamente 100%.';
  end if;

  delete from public.quotas_servico where servico_id = p_servico;
  insert into public.quotas_servico (servico_id, colaborador_id, quota, definido_por)
  select p_servico, x, round((p_quotas ->> x)::numeric, 2), public.nome_utilizador_actual()
  from unnest(v_equipa) as x;
end;
$$;
revoke execute on function public.definir_quotas(text, jsonb) from public, anon;
grant execute on function public.definir_quotas(text, jsonb) to authenticated;