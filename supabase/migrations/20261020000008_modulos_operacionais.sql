-- Galedos Gestão · Base 5: empresa, stock, equipamentos, ocorrências, orçamentos e documentos

-- Registos que só se acrescentam (movimentos, históricos, documentos)
create or replace function public.so_acrescentar()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Este registo não pode ser alterado nem apagado.';
end;
$$;
revoke execute on function public.so_acrescentar() from public, anon, authenticated;

-- ===================== EMPRESA =====================
create table public.empresa (
  id integer primary key default 1 check (id = 1),
  nome text not null default 'Grupo Galedos' check (length(trim(nome)) > 0),
  nif text not null default '',
  morada text not null default '',
  telefone text not null default '',
  email text not null default '',
  rodape text not null default 'Gestão organizada. Serviços controlados. Crescimento sustentável.',
  condicoes text not null default 'O pagamento é devido nos termos acordados com o cliente. Alterações ao serviço devem ser previamente comunicadas.',
  actualizado_em timestamptz not null default now()
);
insert into public.empresa (id) values (1);

alter table public.empresa enable row level security;
create policy empresa_ver on public.empresa for select to authenticated using (public.e_gestao());
revoke all on public.empresa from anon, authenticated;
grant select on public.empresa to authenticated;

create trigger empresa_actualizado before update on public.empresa
  for each row execute function public.definir_actualizado_em();
create trigger empresa_auditoria after insert or update or delete on public.empresa
  for each row execute function public.auditar();

create or replace function public.guardar_empresa(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := left(trim(coalesce(p ->> 'nome', '')), 200);
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if v_nome = '' then
    raise exception 'Indique o nome da empresa.';
  end if;
  update public.empresa set
    nome = v_nome,
    nif = left(trim(coalesce(p ->> 'nif', '')), 50),
    morada = left(trim(coalesce(p ->> 'morada', '')), 300),
    telefone = left(trim(coalesce(p ->> 'telefone', '')), 50),
    email = left(trim(coalesce(p ->> 'email', '')), 200),
    rodape = left(trim(coalesce(p ->> 'rodape', '')), 300),
    condicoes = left(trim(coalesce(p ->> 'condicoes', '')), 1500)
  where id = 1;
end;
$$;
revoke execute on function public.guardar_empresa(jsonb) from public, anon;
grant execute on function public.guardar_empresa(jsonb) to authenticated;

-- ===================== PRODUTOS E STOCK =====================
create sequence public.produtos_seq;

create table public.produtos (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique default ('PRD-' || lpad(nextval('public.produtos_seq')::text, 4, '0')),
  nome text not null check (length(trim(nome)) > 0),
  categoria text not null check (length(trim(categoria)) > 0),
  unidade text not null default 'unidade',
  quantidade numeric(14,3) not null default 0 check (quantidade >= 0),
  minimo numeric(14,3) not null default 0 check (minimo >= 0),
  fornecedor text not null default '',
  custo numeric(14,2) not null default 0 check (custo >= 0),
  estado text not null default 'Activo' check (estado in ('Activo', 'Inactivo')),
  ultima_entrada date,
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);

create table public.movimentos_stock (
  id bigint generated always as identity primary key,
  produto_id text not null references public.produtos (id),
  tipo text not null check (tipo in (
    'Entrada por compra', 'Saída para utilização', 'Devolução', 'Ajuste de inventário', 'Perda ou inutilização')),
  variacao numeric(14,3) not null,
  saldo_apos numeric(14,3) not null check (saldo_apos >= 0),
  data date not null default ((now() at time zone 'Africa/Luanda')::date),
  responsavel text not null default 'Sistema',
  motivo text not null check (length(trim(motivo)) > 0),
  criado_em timestamptz not null default now()
);
create index movimentos_stock_produto_idx on public.movimentos_stock (produto_id);

alter table public.produtos enable row level security;
create policy produtos_ver on public.produtos for select to authenticated using (public.e_gestao());
revoke all on public.produtos from anon, authenticated;
grant select on public.produtos to authenticated;

alter table public.movimentos_stock enable row level security;
create policy movimentos_ver on public.movimentos_stock for select to authenticated using (public.e_gestao());
revoke all on public.movimentos_stock from anon, authenticated;
grant select on public.movimentos_stock to authenticated;

create trigger produtos_actualizado before update on public.produtos
  for each row execute function public.definir_actualizado_em();
create trigger produtos_auditoria after insert or update or delete on public.produtos
  for each row execute function public.auditar();
create trigger movimentos_imutaveis before update or delete on public.movimentos_stock
  for each row execute function public.so_acrescentar();
create trigger movimentos_auditoria after insert on public.movimentos_stock
  for each row execute function public.auditar();

create or replace function public.criar_produto(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := trim(coalesce(p ->> 'nome', ''));
  v_cat text := trim(coalesce(p ->> 'categoria', ''));
  v_unid text := coalesce(nullif(trim(coalesce(p ->> 'unidade', '')), ''), 'unidade');
  v_forn text := trim(coalesce(p ->> 'fornecedor', ''));
  v_qtd numeric := round((p ->> 'quantidade')::numeric, 3);
  v_min numeric := round((p ->> 'minimo')::numeric, 3);
  v_custo numeric := round((p ->> 'custo')::numeric, 2);
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_id text;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if v_nome = '' then
    raise exception 'Indique o nome do produto.';
  end if;
  if v_cat = '' then
    raise exception 'Seleccione a categoria.';
  end if;
  if v_qtd is null or v_min is null or v_custo is null then
    raise exception 'Indique valores numéricos válidos para quantidade, mínimo e custo.';
  end if;
  if v_qtd < 0 or v_min < 0 or v_custo < 0 then
    raise exception 'Quantidade, mínimo e custo não podem ser negativos.';
  end if;

  insert into public.produtos (nome, categoria, unidade, quantidade, minimo, fornecedor, custo, ultima_entrada)
  values (v_nome, v_cat, v_unid, v_qtd, v_min, v_forn, v_custo, case when v_qtd > 0 then v_hoje else null end)
  returning id into v_id;

  if v_qtd > 0 then
    insert into public.movimentos_stock (produto_id, tipo, variacao, saldo_apos, responsavel, motivo)
    values (v_id, 'Entrada por compra', v_qtd, v_qtd, public.nome_utilizador_actual(), 'Stock inicial');
  end if;
  return v_id;
end;
$$;
revoke execute on function public.criar_produto(jsonb) from public, anon;
grant execute on function public.criar_produto(jsonb) to authenticated;

create or replace function public.movimentar_stock(p_produto text, p_tipo text, p_valor numeric, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p record;
  v_val numeric := round(p_valor, 3);
  v_var numeric;
  v_saldo numeric;
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  select * into v_p from public.produtos where id = p_produto for update;
  if not found then
    raise exception 'Seleccione o produto.';
  end if;
  if v_p.estado = 'Inactivo' then
    raise exception 'O produto está inactivo.';
  end if;
  if v_val is null then
    raise exception 'Indique uma quantidade válida.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 then
    raise exception 'O motivo do movimento é obrigatório.';
  end if;

  if p_tipo in ('Entrada por compra', 'Devolução') then
    if not (v_val > 0) then
      raise exception 'A quantidade deve ser superior a zero.';
    end if;
    v_var := v_val;
  elsif p_tipo in ('Saída para utilização', 'Perda ou inutilização') then
    if not (v_val > 0) then
      raise exception 'A quantidade deve ser superior a zero.';
    end if;
    if v_val > v_p.quantidade then
      raise exception 'A quantidade excede o stock disponível (%).', trim_scale(v_p.quantidade)::text;
    end if;
    v_var := -v_val;
  elsif p_tipo = 'Ajuste de inventário' then
    if v_val < 0 then
      raise exception 'A quantidade contada não pode ser negativa.';
    end if;
    v_var := v_val - v_p.quantidade;
    if v_var = 0 then
      raise exception 'A contagem coincide com o stock actual; não há ajuste a registar.';
    end if;
  else
    raise exception 'Tipo de movimento inválido.';
  end if;

  v_saldo := v_p.quantidade + v_var;
  update public.produtos
  set quantidade = v_saldo,
      ultima_entrada = case when p_tipo = 'Entrada por compra' then v_hoje else ultima_entrada end
  where id = p_produto;
  insert into public.movimentos_stock (produto_id, tipo, variacao, saldo_apos, responsavel, motivo)
  values (p_produto, p_tipo, v_var, v_saldo, public.nome_utilizador_actual(), left(trim(p_motivo), 500));
end;
$$;
revoke execute on function public.movimentar_stock(text, text, numeric, text) from public, anon;
grant execute on function public.movimentar_stock(text, text, numeric, text) to authenticated;

create or replace function public.alternar_produto(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  update public.produtos
  set estado = case when estado = 'Activo' then 'Inactivo' else 'Activo' end
  where id = p_id;
  if not found then
    raise exception 'Produto não encontrado.';
  end if;
end;
$$;
revoke execute on function public.alternar_produto(text) from public, anon;
grant execute on function public.alternar_produto(text) to authenticated;

-- ===================== EQUIPAMENTOS =====================
create sequence public.equipamentos_seq;

create table public.equipamentos (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique default ('EQP-' || lpad(nextval('public.equipamentos_seq')::text, 4, '0')),
  nome text not null check (length(trim(nome)) > 0),
  categoria text not null default 'Outro',
  estado text not null default 'Operacional' check (estado in ('Operacional', 'Em manutenção', 'Avariado', 'Abatido')),
  data_aquisicao date,
  responsavel_id text references public.colaboradores (id),
  observacoes text not null default '',
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);

create table public.manutencoes_equipamento (
  id text primary key default gen_random_uuid()::text,
  equipamento_id text not null references public.equipamentos (id),
  data date not null default ((now() at time zone 'Africa/Luanda')::date),
  descricao text not null check (length(trim(descricao)) > 0),
  custo numeric(14,2) not null default 0 check (custo >= 0),
  utilizador_nome text not null default 'Sistema',
  criado_em timestamptz not null default now()
);
create index manutencoes_equipamento_idx on public.manutencoes_equipamento (equipamento_id);

create table public.equipamento_historico (
  id bigint generated always as identity primary key,
  equipamento_id text not null references public.equipamentos (id),
  data timestamptz not null default now(),
  utilizador_nome text not null default 'Sistema',
  accao text not null
);
create index equipamento_historico_idx on public.equipamento_historico (equipamento_id);

alter table public.equipamentos enable row level security;
create policy equipamentos_ver on public.equipamentos for select to authenticated using (public.e_gestao());
revoke all on public.equipamentos from anon, authenticated;
grant select on public.equipamentos to authenticated;

alter table public.manutencoes_equipamento enable row level security;
create policy manutencoes_ver on public.manutencoes_equipamento for select to authenticated using (public.e_gestao());
revoke all on public.manutencoes_equipamento from anon, authenticated;
grant select on public.manutencoes_equipamento to authenticated;

alter table public.equipamento_historico enable row level security;
create policy equipamento_historico_ver on public.equipamento_historico for select to authenticated using (public.e_gestao());
revoke all on public.equipamento_historico from anon, authenticated;
grant select on public.equipamento_historico to authenticated;

create trigger equipamentos_actualizado before update on public.equipamentos
  for each row execute function public.definir_actualizado_em();
create trigger equipamentos_auditoria after insert or update or delete on public.equipamentos
  for each row execute function public.auditar();
create trigger manutencoes_auditoria after insert or update or delete on public.manutencoes_equipamento
  for each row execute function public.auditar();
create trigger manutencoes_imutaveis before update or delete on public.manutencoes_equipamento
  for each row execute function public.so_acrescentar();
create trigger equipamento_historico_imutavel before update or delete on public.equipamento_historico
  for each row execute function public.so_acrescentar();

create or replace function public.criar_equipamento(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := trim(coalesce(p ->> 'nome', ''));
  v_cat text := coalesce(nullif(trim(coalesce(p ->> 'categoria', '')), ''), 'Outro');
  v_data date := nullif(p ->> 'data_aquisicao', '')::date;
  v_obs text := left(trim(coalesce(p ->> 'observacoes', '')), 500);
  v_id text;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if v_nome = '' then
    raise exception 'Indique o nome do equipamento.';
  end if;
  if v_data is not null and v_data > (now() at time zone 'Africa/Luanda')::date then
    raise exception 'A data de aquisição não pode estar no futuro.';
  end if;
  insert into public.equipamentos (nome, categoria, data_aquisicao, observacoes)
  values (v_nome, v_cat, v_data, v_obs)
  returning id into v_id;
  insert into public.equipamento_historico (equipamento_id, utilizador_nome, accao)
  values (v_id, public.nome_utilizador_actual(), 'Equipamento registado');
  return v_id;
end;
$$;
revoke execute on function public.criar_equipamento(jsonb) from public, anon;
grant execute on function public.criar_equipamento(jsonb) to authenticated;

create or replace function public.alterar_estado_equipamento(p_id text, p_estado text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_e record;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_estado is null or p_estado not in ('Operacional', 'Em manutenção', 'Avariado', 'Abatido') then
    raise exception 'Estado inválido.';
  end if;
  select * into v_e from public.equipamentos where id = p_id for update;
  if not found then
    raise exception 'Equipamento não encontrado.';
  end if;
  if v_e.estado = p_estado then
    return;
  end if;
  update public.equipamentos set estado = p_estado where id = p_id;
  insert into public.equipamento_historico (equipamento_id, utilizador_nome, accao)
  values (p_id, public.nome_utilizador_actual(),
          'Estado alterado de "' || v_e.estado || '" para "' || p_estado || '"');
end;
$$;
revoke execute on function public.alterar_estado_equipamento(text, text) from public, anon;
grant execute on function public.alterar_estado_equipamento(text, text) to authenticated;

create or replace function public.atribuir_equipamento(p_id text, p_colaborador text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_e record;
  v_col text := nullif(trim(coalesce(p_colaborador, '')), '');
  v_nome text;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  select * into v_e from public.equipamentos where id = p_id for update;
  if not found then
    raise exception 'Equipamento não encontrado.';
  end if;
  if v_e.responsavel_id is not distinct from v_col then
    return;
  end if;
  if v_col is not null then
    select nome into v_nome from public.colaboradores where id = v_col and estado = 'Activo';
    if not found then
      raise exception 'Só é possível atribuir a colaboradores activos.';
    end if;
  end if;
  update public.equipamentos set responsavel_id = v_col where id = p_id;
  insert into public.equipamento_historico (equipamento_id, utilizador_nome, accao)
  values (p_id, public.nome_utilizador_actual(),
          case when v_col is null then 'Devolvido à empresa' else 'Entregue a ' || v_nome end);
end;
$$;
revoke execute on function public.atribuir_equipamento(text, text) from public, anon;
grant execute on function public.atribuir_equipamento(text, text) to authenticated;

create or replace function public.registar_manutencao(p_id text, p_descricao text, p_custo numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_desc text := left(trim(coalesce(p_descricao, '')), 500);
  v_custo numeric := round(p_custo, 2);
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if not exists (select 1 from public.equipamentos where id = p_id) then
    raise exception 'Equipamento não encontrado.';
  end if;
  if v_desc = '' then
    raise exception 'Descreva a manutenção realizada.';
  end if;
  if v_custo is null or v_custo < 0 then
    raise exception 'Custo inválido.';
  end if;
  insert into public.manutencoes_equipamento (equipamento_id, descricao, custo, utilizador_nome)
  values (p_id, v_desc, v_custo, public.nome_utilizador_actual());
  insert into public.equipamento_historico (equipamento_id, utilizador_nome, accao)
  values (p_id, public.nome_utilizador_actual(), 'Manutenção registada: ' || v_desc);
end;
$$;
revoke execute on function public.registar_manutencao(text, text, numeric) from public, anon;
grant execute on function public.registar_manutencao(text, text, numeric) to authenticated;

-- ===================== OCORRÊNCIAS =====================
create sequence public.ocorrencias_seq;

create table public.ocorrencias (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique default ('OCO-' || lpad(nextval('public.ocorrencias_seq')::text, 4, '0')),
  servico_id text references public.servicos (id),
  data date not null,
  tipo text not null check (tipo in (
    'Reclamação do cliente', 'Danos identificados', 'Equipamento avariado', 'Atraso no serviço',
    'Falta de material', 'Problema técnico', 'Necessidade de intervenção adicional')),
  descricao text not null check (length(trim(descricao)) > 0),
  pessoas text not null default '',
  responsavel text not null default '',
  estado text not null default 'Aberta' check (estado in ('Aberta', 'Em análise', 'Em resolução', 'Resolvida', 'Encerrada')),
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);
create index ocorrencias_servico_idx on public.ocorrencias (servico_id);

create table public.ocorrencia_historico (
  id bigint generated always as identity primary key,
  ocorrencia_id text not null references public.ocorrencias (id),
  data timestamptz not null default now(),
  utilizador_nome text not null default 'Sistema',
  accao text not null
);
create index ocorrencia_historico_idx on public.ocorrencia_historico (ocorrencia_id);

alter table public.ocorrencias enable row level security;
create policy ocorrencias_ver on public.ocorrencias for select to authenticated using (public.e_gestao());
revoke all on public.ocorrencias from anon, authenticated;
grant select on public.ocorrencias to authenticated;

alter table public.ocorrencia_historico enable row level security;
create policy ocorrencia_historico_ver on public.ocorrencia_historico for select to authenticated using (public.e_gestao());
revoke all on public.ocorrencia_historico from anon, authenticated;
grant select on public.ocorrencia_historico to authenticated;

create trigger ocorrencias_actualizado before update on public.ocorrencias
  for each row execute function public.definir_actualizado_em();
create trigger ocorrencias_auditoria after insert or update or delete on public.ocorrencias
  for each row execute function public.auditar();
create trigger ocorrencia_historico_imutavel before update or delete on public.ocorrencia_historico
  for each row execute function public.so_acrescentar();

create or replace function public.criar_ocorrencia(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := trim(coalesce(p ->> 'tipo', ''));
  v_desc text := left(trim(coalesce(p ->> 'descricao', '')), 2000);
  v_data date := nullif(p ->> 'data', '')::date;
  v_serv text := nullif(p ->> 'servico_id', '');
  v_id text;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if v_tipo = '' then
    raise exception 'Seleccione o tipo de ocorrência.';
  end if;
  if v_desc = '' then
    raise exception 'Descreva a ocorrência.';
  end if;
  if v_data is null then
    raise exception 'Indique a data.';
  end if;
  if v_serv is not null and not exists (select 1 from public.servicos where id = v_serv) then
    raise exception 'Serviço não encontrado.';
  end if;
  insert into public.ocorrencias (servico_id, data, tipo, descricao, pessoas, responsavel)
  values (v_serv, v_data, v_tipo, v_desc,
          left(trim(coalesce(p ->> 'pessoas', '')), 300),
          left(trim(coalesce(p ->> 'responsavel', '')), 200))
  returning id into v_id;
  insert into public.ocorrencia_historico (ocorrencia_id, utilizador_nome, accao)
  values (v_id, public.nome_utilizador_actual(), 'Ocorrência registada (estado: Aberta)');
  return v_id;
end;
$$;
revoke execute on function public.criar_ocorrencia(jsonb) from public, anon;
grant execute on function public.criar_ocorrencia(jsonb) to authenticated;

create or replace function public.mudar_estado_ocorrencia(p_id text, p_novo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_o record;
  v_validos text[];
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  select * into v_o from public.ocorrencias where id = p_id for update;
  if not found then
    raise exception 'Ocorrência não encontrada.';
  end if;
  v_validos := case v_o.estado
    when 'Aberta' then array['Em análise']
    when 'Em análise' then array['Em resolução', 'Resolvida']
    when 'Em resolução' then array['Resolvida']
    when 'Resolvida' then array['Encerrada', 'Em análise']
    else array[]::text[]
  end;
  if p_novo is null or not (p_novo = any (v_validos)) then
    raise exception 'Não é possível passar de "%" para "%".', v_o.estado, coalesce(p_novo, '');
  end if;
  update public.ocorrencias set estado = p_novo where id = p_id;
  insert into public.ocorrencia_historico (ocorrencia_id, utilizador_nome, accao)
  values (p_id, public.nome_utilizador_actual(),
          'Estado alterado de "' || v_o.estado || '" para "' || p_novo || '"');
end;
$$;
revoke execute on function public.mudar_estado_ocorrencia(text, text) from public, anon;
grant execute on function public.mudar_estado_ocorrencia(text, text) to authenticated;

create or replace function public.adicionar_medida_ocorrencia(p_id text, p_texto text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_o record;
  v_txt text := left(trim(coalesce(p_texto, '')), 1000);
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  select * into v_o from public.ocorrencias where id = p_id for update;
  if not found then
    raise exception 'Ocorrência não encontrada.';
  end if;
  if v_o.estado = 'Encerrada' then
    raise exception 'A ocorrência está encerrada.';
  end if;
  if v_txt = '' then
    raise exception 'Descreva a medida ou decisão.';
  end if;
  insert into public.ocorrencia_historico (ocorrencia_id, utilizador_nome, accao)
  values (p_id, public.nome_utilizador_actual(), 'Medida adoptada: ' || v_txt);
end;
$$;
revoke execute on function public.adicionar_medida_ocorrencia(text, text) from public, anon;
grant execute on function public.adicionar_medida_ocorrencia(text, text) to authenticated;

-- ===================== DOCUMENTOS =====================
create table public.contadores_documento (
  tipo text not null,
  ano integer not null,
  ultimo integer not null default 0,
  primary key (tipo, ano)
);
alter table public.contadores_documento enable row level security;
revoke all on public.contadores_documento from anon, authenticated;

create table public.documentos_emitidos (
  id text primary key default gen_random_uuid()::text,
  tipo text not null check (tipo in ('orcamento', 'ordem', 'ficha', 'mapa', 'recibo', 'termo', 'financeiro')),
  ref_id text not null check (length(ref_id) > 0),
  numero text not null unique,
  data_emissao date not null default ((now() at time zone 'Africa/Luanda')::date),
  utilizador_nome text not null default 'Sistema',
  criado_em timestamptz not null default now(),
  unique (tipo, ref_id)
);

alter table public.documentos_emitidos enable row level security;
create policy documentos_ver on public.documentos_emitidos for select to authenticated
  using (public.e_admin() or (public.e_gestao() and tipo in ('orcamento', 'ordem', 'ficha', 'termo')));
revoke all on public.documentos_emitidos from anon, authenticated;
grant select on public.documentos_emitidos to authenticated;

create trigger documentos_imutaveis before update or delete on public.documentos_emitidos
  for each row execute function public.so_acrescentar();
create trigger documentos_auditoria after insert on public.documentos_emitidos
  for each row execute function public.auditar();

create or replace function public.emitir_documento_interno(p_tipo text, p_ref text)
returns public.documentos_emitidos language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documentos_emitidos;
  v_ano integer := extract(year from (now() at time zone 'Africa/Luanda'))::integer;
  v_n integer;
  v_prefixo text;
begin
  v_prefixo := case p_tipo
    when 'orcamento' then 'ORC' when 'ordem' then 'OS' when 'ficha' then 'FSC'
    when 'mapa' then 'MAP' when 'recibo' then 'REC' when 'termo' then 'TEE'
    when 'financeiro' then 'RF' else null end;
  if v_prefixo is null then
    raise exception 'Tipo de documento inválido.';
  end if;
  if p_ref is null or length(trim(p_ref)) = 0 then
    raise exception 'Referência do documento em falta.';
  end if;
  perform pg_advisory_xact_lock(hashtext('emitir:' || p_tipo || ':' || p_ref));
  select * into v_doc from public.documentos_emitidos where tipo = p_tipo and ref_id = p_ref;
  if found then
    return v_doc;
  end if;
  insert into public.contadores_documento (tipo, ano, ultimo) values (p_tipo, v_ano, 1)
    on conflict (tipo, ano) do update set ultimo = public.contadores_documento.ultimo + 1
    returning ultimo into v_n;
  insert into public.documentos_emitidos (tipo, ref_id, numero, utilizador_nome)
  values (p_tipo, p_ref, v_prefixo || '-' || v_ano::text || '-' || lpad(v_n::text, 4, '0'),
          public.nome_utilizador_actual())
  returning * into v_doc;
  return v_doc;
end;
$$;
revoke execute on function public.emitir_documento_interno(text, text) from public, anon, authenticated;

create or replace function public.emitir_documento(p_tipo text, p_ref text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documentos_emitidos;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_tipo in ('mapa', 'recibo', 'financeiro') and not public.e_admin() then
    raise exception 'Sem permissão para emitir este tipo de documento.';
  end if;
  if p_tipo in ('orcamento', 'ordem', 'ficha') then
    if not exists (select 1 from public.servicos where id = p_ref) then
      raise exception 'Serviço não encontrado.';
    end if;
  elsif p_tipo = 'termo' then
    if not exists (select 1 from public.equipamentos where id = p_ref) then
      raise exception 'Equipamento não encontrado.';
    end if;
  elsif p_tipo = 'recibo' then
    if not exists (select 1 from public.pagamentos_colaboradores where id = p_ref) then
      raise exception 'Pagamento não encontrado.';
    end if;
  elsif p_tipo = 'mapa' then
    if p_ref is null or p_ref !~ '^\d{4}-(0[1-9]|1[0-2])$' then
      raise exception 'Período inválido.';
    end if;
  elsif p_tipo = 'financeiro' then
    if p_ref is null or p_ref !~ '^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$' then
      raise exception 'Período inválido.';
    end if;
  end if;
  v_doc := public.emitir_documento_interno(p_tipo, p_ref);
  return to_jsonb(v_doc);
end;
$$;
revoke execute on function public.emitir_documento(text, text) from public, anon;
grant execute on function public.emitir_documento(text, text) to authenticated;

-- ===================== ORÇAMENTOS =====================
create table public.orcamentos (
  id text primary key default gen_random_uuid()::text,
  servico_id text not null unique references public.servicos (id),
  numero text not null,
  valor numeric(14,2) not null check (valor > 0),
  data_envio date not null default ((now() at time zone 'Africa/Luanda')::date),
  estado text not null default 'Enviado' check (estado in ('Enviado', 'Aceite', 'Recusado')),
  data_resposta date,
  motivo text not null default '',
  utilizador_nome text not null default 'Sistema',
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);

alter table public.orcamentos enable row level security;
create policy orcamentos_ver on public.orcamentos for select to authenticated using (public.e_gestao());
revoke all on public.orcamentos from anon, authenticated;
grant select on public.orcamentos to authenticated;

create or replace function public.orcamentos_regras()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.estado <> 'Enviado' then
    raise exception 'Este orçamento já foi respondido.';
  end if;
  if (to_jsonb(new) - 'estado' - 'data_resposta' - 'motivo' - 'actualizado_em')
     is distinct from (to_jsonb(old) - 'estado' - 'data_resposta' - 'motivo' - 'actualizado_em') then
    raise exception 'Os dados do orçamento não podem ser alterados.';
  end if;
  return new;
end;
$$;
revoke execute on function public.orcamentos_regras() from public, anon, authenticated;

create trigger orcamentos_a_regras before update on public.orcamentos
  for each row execute function public.orcamentos_regras();
create trigger orcamentos_b_actualizado before update on public.orcamentos
  for each row execute function public.definir_actualizado_em();
create trigger orcamentos_c_auditoria after insert or update or delete on public.orcamentos
  for each row execute function public.auditar();

create or replace function public.registar_orcamento(p_servico text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
  v_doc public.documentos_emitidos;
  v_id text;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  select id, estado_operacional, total into v_s from public.servicos where id = p_servico for update;
  if not found then
    raise exception 'Seleccione o serviço.';
  end if;
  if v_s.estado_operacional not in ('Pedido recebido', 'A aguardar orçamento', 'Orçamento enviado', 'A aguardar confirmação') then
    raise exception 'Só é possível registar orçamento antes de o serviço ser agendado.';
  end if;
  if exists (select 1 from public.orcamentos where servico_id = p_servico) then
    raise exception 'Este serviço já tem um orçamento registado.';
  end if;
  if not (v_s.total > 0) then
    raise exception 'O serviço tem valor total zero.';
  end if;
  v_doc := public.emitir_documento_interno('orcamento', p_servico);
  insert into public.orcamentos (servico_id, numero, valor, utilizador_nome)
  values (p_servico, v_doc.numero, v_s.total, public.nome_utilizador_actual())
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.registar_orcamento(text) from public, anon;
grant execute on function public.registar_orcamento(text) to authenticated;

create or replace function public.responder_orcamento(p_id text, p_aceite boolean, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_o record;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_aceite is null then
    raise exception 'Indique se o orçamento foi aceite ou recusado.';
  end if;
  select * into v_o from public.orcamentos where id = p_id for update;
  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;
  if v_o.estado <> 'Enviado' then
    raise exception 'Este orçamento já foi respondido.';
  end if;
  update public.orcamentos
  set estado = case when p_aceite then 'Aceite' else 'Recusado' end,
      data_resposta = (now() at time zone 'Africa/Luanda')::date,
      motivo = left(trim(coalesce(p_motivo, '')), 500)
  where id = p_id;
end;
$$;
revoke execute on function public.responder_orcamento(text, boolean, text) from public, anon;
grant execute on function public.responder_orcamento(text, boolean, text) to authenticated;