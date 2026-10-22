-- Galedos Gestão · Ronda 4c: fotos antes e depois, listas de verificação e confirmação do cliente

create or replace function public.pode_ver_servico(p_servico text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.e_gestao() or exists (
    select 1 from public.servico_colaboradores sc
    where sc.servico_id = p_servico and sc.colaborador_id = public.colaborador_actual());
$$;
revoke execute on function public.pode_ver_servico(text) from public, anon;
grant execute on function public.pode_ver_servico(text) to authenticated;

-- ===================== ARMAZENAMENTO (privado, só JPEG até 2 MB) =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-servico', 'fotos-servico', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy fotos_servico_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-servico' and public.pode_ver_servico((storage.foldername(name))[1]));
create policy fotos_servico_ler on storage.objects for select to authenticated
  using (bucket_id = 'fotos-servico' and public.pode_ver_servico((storage.foldername(name))[1]));

-- ===================== FOTOS =====================
create table public.fotos_servico (
  id text primary key default gen_random_uuid()::text,
  servico_id text not null references public.servicos (id),
  colaborador_id text not null references public.colaboradores (id),
  fase text not null check (fase in ('Antes', 'Depois')),
  caminho text not null unique check (length(caminho) between 10 and 200),
  criado_em timestamptz not null default now()
);
create index fotos_servico_idx on public.fotos_servico (servico_id);

alter table public.fotos_servico enable row level security;
create policy fotos_ver on public.fotos_servico for select to authenticated
  using (public.e_gestao() or colaborador_id = public.colaborador_actual());
revoke all on public.fotos_servico from anon, authenticated;
grant select on public.fotos_servico to authenticated;

create trigger fotos_imutaveis before update or delete on public.fotos_servico
  for each row execute function public.so_acrescentar();
create trigger fotos_auditoria after insert on public.fotos_servico
  for each row execute function public.auditar();

-- ===================== LISTAS DE VERIFICAÇÃO =====================
create table public.checklist_itens (
  id text primary key default gen_random_uuid()::text,
  catalogo_id text not null references public.catalogo_servicos (id),
  texto text not null check (length(trim(texto)) between 3 and 200),
  ordem integer not null,
  activo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index checklist_itens_idx on public.checklist_itens (catalogo_id, ordem);

alter table public.checklist_itens enable row level security;
create policy checklist_itens_ver on public.checklist_itens for select to authenticated using (public.e_gestao());
revoke all on public.checklist_itens from anon, authenticated;
grant select on public.checklist_itens to authenticated;
create trigger checklist_itens_auditoria after insert or update or delete on public.checklist_itens
  for each row execute function public.auditar();

insert into public.checklist_itens (catalogo_id, texto, ordem)
select c.id, t.texto, t.ordem
from public.catalogo_servicos c
cross join (values
  (1, 'Inspeccionar o estofado e registar danos ou manchas prévias'),
  (2, 'Aspirar a superfície e as juntas'),
  (3, 'Aplicar o produto adequado ao tecido'),
  (4, 'Limpar e extrair a sujidade'),
  (5, 'Verificar o resultado com o cliente')
) as t(ordem, texto);

create table public.execucao_checklist (
  id text primary key default gen_random_uuid()::text,
  execucao_id text not null references public.execucoes_servico (id),
  item_id text not null references public.checklist_itens (id),
  texto text not null,
  feito boolean not null default false,
  actualizado_em timestamptz not null default now(),
  unique (execucao_id, item_id)
);
alter table public.execucao_checklist enable row level security;
create policy execucao_checklist_ver on public.execucao_checklist for select to authenticated using (public.e_gestao());
revoke all on public.execucao_checklist from anon, authenticated;
grant select on public.execucao_checklist to authenticated;

create or replace function public.adicionar_item_checklist(p_catalogo text, p_texto text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_texto text := left(trim(coalesce(p_texto, '')), 200);
  v_ordem integer;
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  perform 1 from public.catalogo_servicos where id = p_catalogo for update;
  if not found then
    raise exception 'Serviço do catálogo não encontrado.';
  end if;
  if length(v_texto) < 3 then
    raise exception 'Escreva o item (mínimo 3 letras).';
  end if;
  select coalesce(max(ordem), 0) + 1 into v_ordem from public.checklist_itens where catalogo_id = p_catalogo;
  if v_ordem > 30 then
    raise exception 'Máximo de 30 itens por serviço.';
  end if;
  insert into public.checklist_itens (catalogo_id, texto, ordem) values (p_catalogo, v_texto, v_ordem);
end;
$$;
revoke execute on function public.adicionar_item_checklist(text, text) from public, anon;
grant execute on function public.adicionar_item_checklist(text, text) to authenticated;

create or replace function public.alternar_item_checklist(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  update public.checklist_itens set activo = not activo where id = p_id;
  if not found then
    raise exception 'Item não encontrado.';
  end if;
end;
$$;
revoke execute on function public.alternar_item_checklist(text) from public, anon;
grant execute on function public.alternar_item_checklist(text) to authenticated;

-- ===================== CONFIRMAÇÃO DO CLIENTE =====================
create table public.confirmacoes_cliente (
  id text primary key default gen_random_uuid()::text,
  servico_id text not null unique references public.servicos (id),
  nome text not null check (length(trim(nome)) >= 2),
  assinatura text not null check (assinatura like 'data:image/png;base64,%' and length(assinatura) between 300 and 200000),
  satisfeito boolean not null,
  comentario text not null default '',
  registado_por text not null references public.colaboradores (id),
  registado_por_nome text not null default 'Sistema',
  criado_em timestamptz not null default now()
);
alter table public.confirmacoes_cliente enable row level security;
create policy confirmacoes_ver on public.confirmacoes_cliente for select to authenticated using (public.e_gestao());
revoke all on public.confirmacoes_cliente from anon, authenticated;
grant select on public.confirmacoes_cliente to authenticated;
create trigger confirmacoes_imutaveis before update or delete on public.confirmacoes_cliente
  for each row execute function public.so_acrescentar();

-- ===================== FUNÇÕES DO COLABORADOR =====================
create or replace function public.meu_painel_servico(p_servico text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_actual();
  v_cat text;
  v_exec text;
begin
  if v_col is null then
    return jsonb_build_object('checklist', '[]'::jsonb, 'antes', 0, 'depois', 0, 'confirmada', false);
  end if;
  if not exists (select 1 from public.servico_colaboradores where servico_id = p_servico and colaborador_id = v_col) then
    raise exception 'Este serviço não lhe está atribuído.';
  end if;
  select catalogo_id into v_cat from public.servicos where id = p_servico;
  select id into v_exec from public.execucoes_servico where servico_id = p_servico and colaborador_id = v_col;
  return jsonb_build_object(
    'checklist', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'texto', i.texto, 'feito', coalesce(ec.feito, false)) order by i.ordem, i.id)
      from public.checklist_itens i
      left join public.execucao_checklist ec on ec.item_id = i.id and ec.execucao_id = v_exec
      where i.catalogo_id = v_cat and (i.activo or ec.item_id is not null)), '[]'::jsonb),
    'antes', (select count(*) from public.fotos_servico where servico_id = p_servico and colaborador_id = v_col and fase = 'Antes'),
    'depois', (select count(*) from public.fotos_servico where servico_id = p_servico and colaborador_id = v_col and fase = 'Depois'),
    'confirmada', exists (select 1 from public.confirmacoes_cliente where servico_id = p_servico));
end;
$$;
revoke execute on function public.meu_painel_servico(text) from public, anon;
grant execute on function public.meu_painel_servico(text) to authenticated;

create or replace function public.marcar_checklist(p_servico text, p_item text, p_feito boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_exec text;
  v_texto text;
begin
  if p_feito is null then
    raise exception 'Indique se o item foi feito.';
  end if;
  if not exists (select 1 from public.servico_colaboradores where servico_id = p_servico and colaborador_id = v_col) then
    raise exception 'Este serviço não lhe está atribuído.';
  end if;
  select id into v_exec from public.execucoes_servico
  where servico_id = p_servico and colaborador_id = v_col and fim_em is null;
  if not found then
    raise exception 'Marque primeiro a chegada ao local ou o início do serviço.';
  end if;
  select i.texto into v_texto from public.checklist_itens i
  join public.servicos s on s.catalogo_id = i.catalogo_id
  where i.id = p_item and s.id = p_servico;
  if not found then
    raise exception 'Item inválido para este serviço.';
  end if;
  insert into public.execucao_checklist (execucao_id, item_id, texto, feito)
  values (v_exec, p_item, v_texto, p_feito)
  on conflict (execucao_id, item_id) do update set feito = excluded.feito, actualizado_em = now();
end;
$$;
revoke execute on function public.marcar_checklist(text, text, boolean) from public, anon;
grant execute on function public.marcar_checklist(text, text, boolean) to authenticated;

create or replace function public.registar_foto(p_servico text, p_fase text, p_caminho text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_n integer;
  v_id text;
begin
  if p_fase not in ('Antes', 'Depois') then
    raise exception 'Fase da foto inválida.';
  end if;
  if not exists (select 1 from public.servico_colaboradores where servico_id = p_servico and colaborador_id = v_col) then
    raise exception 'Este serviço não lhe está atribuído.';
  end if;
  if not exists (select 1 from public.execucoes_servico where servico_id = p_servico and colaborador_id = v_col and fim_em is null) then
    raise exception 'Marque primeiro a chegada ao local ou o início do serviço.';
  end if;
  if p_caminho is null or left(p_caminho, length(p_servico) + 1) <> p_servico || '/'
     or p_caminho !~ '^[^/]+/[A-Za-z0-9-]+\.jpg$' then
    raise exception 'Ficheiro de foto inválido.';
  end if;
  select count(*) into v_n from public.fotos_servico
  where servico_id = p_servico and colaborador_id = v_col and fase = p_fase;
  if v_n >= 8 then
    raise exception 'Máximo de 8 fotos por fase.';
  end if;
  insert into public.fotos_servico (servico_id, colaborador_id, fase, caminho)
  values (p_servico, v_col, p_fase, p_caminho)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.registar_foto(text, text, text) from public, anon;
grant execute on function public.registar_foto(text, text, text) to authenticated;

create or replace function public.registar_confirmacao(
  p_servico text, p_nome text, p_assinatura text, p_satisfeito boolean, p_comentario text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_nome text := left(trim(coalesce(p_nome, '')), 100);
  v_estado text;
begin
  if length(v_nome) < 2 then
    raise exception 'Indique o nome de quem confirma.';
  end if;
  if p_assinatura is null or p_assinatura not like 'data:image/png;base64,%' or length(p_assinatura) not between 300 and 200000 then
    raise exception 'Assinatura em falta ou inválida.';
  end if;
  if p_satisfeito is null then
    raise exception 'Indique se o cliente ficou satisfeito.';
  end if;
  if not exists (select 1 from public.servico_colaboradores where servico_id = p_servico and colaborador_id = v_col) then
    raise exception 'Este serviço não lhe está atribuído.';
  end if;
  if not exists (select 1 from public.execucoes_servico where servico_id = p_servico and colaborador_id = v_col and inicio_em is not null) then
    raise exception 'Só pode registar a confirmação depois de iniciar o serviço.';
  end if;
  select estado_operacional into v_estado from public.servicos where id = p_servico;
  if v_estado is null or v_estado not in ('Agendado', 'Em execução') then
    raise exception 'A confirmação só pode ser registada antes de o serviço ser concluído pela administração.';
  end if;
  if exists (select 1 from public.confirmacoes_cliente where servico_id = p_servico) then
    raise exception 'Este serviço já tem confirmação do cliente.';
  end if;
  insert into public.confirmacoes_cliente (servico_id, nome, assinatura, satisfeito, comentario, registado_por, registado_por_nome)
  values (p_servico, v_nome, p_assinatura, p_satisfeito, left(trim(coalesce(p_comentario, '')), 500), v_col, public.nome_utilizador_actual());
  insert into public.servico_historico (servico_id, utilizador_nome, accao)
  values (p_servico, public.nome_utilizador_actual(),
          'Confirmação do cliente registada (' || case when p_satisfeito then 'satisfeito' else 'NÃO satisfeito' end || ')');
end;
$$;
revoke execute on function public.registar_confirmacao(text, text, text, boolean, text) from public, anon;
grant execute on function public.registar_confirmacao(text, text, text, boolean, text) to authenticated;