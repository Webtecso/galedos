-- Galedos Gestão · Base 1: perfis, auditoria e clientes

create type public.perfil_utilizador as enum ('administrador', 'gestao', 'operacional');

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text not null default '',
  perfil public.perfil_utilizador not null default 'operacional',
  activo boolean not null default true,
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);

-- O primeiro utilizador criado torna-se administrador; os seguintes ficam operacionais.
create or replace function public.novo_utilizador()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, email, nome, perfil)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    case when exists (select 1 from public.perfis)
         then 'operacional'::public.perfil_utilizador
         else 'administrador'::public.perfil_utilizador end
  );
  return new;
end;
$$;

create trigger ao_criar_utilizador
  after insert on auth.users
  for each row execute function public.novo_utilizador();

-- Funções de apoio às permissões
create or replace function public.perfil_actual()
returns public.perfil_utilizador language sql stable security definer set search_path = '' as $$
  select perfil from public.perfis where id = (select auth.uid()) and activo;
$$;

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.perfil_actual() = 'administrador', false);
$$;

create or replace function public.e_gestao()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.perfil_actual() in ('administrador', 'gestao'), false);
$$;

revoke execute on function public.perfil_actual() from public, anon;
revoke execute on function public.e_admin() from public, anon;
revoke execute on function public.e_gestao() from public, anon;
grant execute on function public.perfil_actual() to authenticated;
grant execute on function public.e_admin() to authenticated;
grant execute on function public.e_gestao() to authenticated;
revoke execute on function public.novo_utilizador() from public, anon, authenticated;

-- Data de actualização automática
create or replace function public.definir_actualizado_em()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_em = now();
  return new;
end;
$$;

-- Auditoria (só acrescenta; só o administrador lê)
create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registo_id text not null,
  operacao text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  utilizador uuid,
  data timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);

create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  linha jsonb;
  v_antes jsonb;
  v_depois jsonb;
begin
  if tg_op = 'DELETE' then
    v_antes := to_jsonb(old);
    linha := v_antes;
  elsif tg_op = 'UPDATE' then
    v_antes := to_jsonb(old);
    v_depois := to_jsonb(new);
    linha := v_depois;
  else
    v_depois := to_jsonb(new);
    linha := v_depois;
  end if;

  insert into public.auditoria (tabela, registo_id, operacao, utilizador, antes, depois)
  values (tg_table_name, coalesce(linha ->> 'id', ''), tg_op, (select auth.uid()), v_antes, v_depois);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.auditar() from public, anon, authenticated;

alter table public.auditoria enable row level security;
create policy auditoria_ver on public.auditoria for select to authenticated using (public.e_admin());
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

-- Perfis
alter table public.perfis enable row level security;
create policy perfis_ver on public.perfis for select to authenticated
  using (id = (select auth.uid()) or public.e_admin());
create policy perfis_actualizar on public.perfis for update to authenticated
  using (public.e_admin()) with check (public.e_admin());
revoke all on public.perfis from anon;
revoke insert, delete, truncate on public.perfis from authenticated;

create trigger perfis_actualizado before update on public.perfis
  for each row execute function public.definir_actualizado_em();
create trigger perfis_auditoria after insert or update or delete on public.perfis
  for each row execute function public.auditar();

-- Clientes
create sequence public.clientes_seq;

create table public.clientes (
  id text primary key default gen_random_uuid()::text,
  codigo text not null unique default ('CLI-' || lpad(nextval('public.clientes_seq')::text, 4, '0')),
  nome text not null check (length(trim(nome)) > 0),
  tipo text not null check (tipo in ('Particular', 'Empresa')),
  telefone text not null check (length(regexp_replace(telefone, '\D', '', 'g')) >= 9),
  email text not null default '',
  endereco text not null default '',
  localizacao text not null default '',
  nif text not null default '',
  data_registo date not null default current_date,
  observacoes text not null default '',
  estado text not null default 'Activo' check (estado in ('Activo', 'Inactivo')),
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now(),
  constraint nif_obrigatorio_empresa check (tipo <> 'Empresa' or length(trim(nif)) > 0)
);

alter table public.clientes enable row level security;
create policy clientes_ver on public.clientes for select to authenticated using (public.e_gestao());
create policy clientes_criar on public.clientes for insert to authenticated with check (public.e_gestao());
create policy clientes_actualizar on public.clientes for update to authenticated
  using (public.e_gestao()) with check (public.e_gestao());
revoke all on public.clientes from anon;
revoke delete, truncate on public.clientes from authenticated;
grant usage, select on sequence public.clientes_seq to authenticated;

create trigger clientes_actualizado before update on public.clientes
  for each row execute function public.definir_actualizado_em();
create trigger clientes_auditoria after insert or update or delete on public.clientes
  for each row execute function public.auditar();