-- Galedos Gestão · Ronda final: primeiro acesso, avisos, equipamentos do colaborador e selfie

-- ===================== PRIMEIRO ACESSO =====================
alter table public.perfis
  add column deve_mudar_password boolean not null default false,
  add column privacidade_aceite_em timestamptz;

create or replace function public.aceitar_privacidade()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.perfis
  set privacidade_aceite_em = coalesce(privacidade_aceite_em, now())
  where id = (select auth.uid()) and activo;
  if not found then
    raise exception 'Conta não encontrada.';
  end if;
end;
$$;
revoke execute on function public.aceitar_privacidade() from public, anon;
grant execute on function public.aceitar_privacidade() to authenticated;

create or replace function public.concluir_mudanca_password()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.perfis set deve_mudar_password = false where id = (select auth.uid()) and activo;
  if not found then
    raise exception 'Conta não encontrada.';
  end if;
end;
$$;
revoke execute on function public.concluir_mudanca_password() from public, anon;
grant execute on function public.concluir_mudanca_password() to authenticated;

-- ===================== SELFIE À ENTRADA =====================
alter table public.presencas add column selfie_caminho text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfies-presenca', 'selfies-presenca', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy selfies_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'selfies-presenca' and (storage.foldername(name))[1] = public.colaborador_actual());
create policy selfies_ler on storage.objects for select to authenticated
  using (bucket_id = 'selfies-presenca'
         and (public.e_gestao() or (storage.foldername(name))[1] = public.colaborador_actual()));

create or replace function public.registar_selfie(p_caminho text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_hoje date := (now() at time zone 'Africa/Luanda')::date;
  v_id text;
begin
  select id into v_id from public.presencas
  where colaborador_id = v_col and data = v_hoje and selfie_caminho is null for update;
  if not found then
    raise exception 'Marque primeiro a entrada, ou a selfie de hoje já foi registada.';
  end if;
  if p_caminho is null or left(p_caminho, length(v_col) + 1) <> v_col || '/'
     or p_caminho !~ '^[^/]+/[A-Za-z0-9-]+\.jpg$' then
    raise exception 'Ficheiro de selfie inválido.';
  end if;
  update public.presencas set selfie_caminho = p_caminho where id = v_id;
end;
$$;
revoke execute on function public.registar_selfie(text) from public, anon;
grant execute on function public.registar_selfie(text) to authenticated;

-- ===================== AVISOS =====================
create table public.avisos (
  id text primary key default gen_random_uuid()::text,
  titulo text not null check (length(trim(titulo)) between 3 and 120),
  texto text not null check (length(trim(texto)) between 3 and 1000),
  colaborador_id text references public.colaboradores (id),
  activo boolean not null default true,
  criado_por_nome text not null default 'Sistema',
  criado_em timestamptz not null default now()
);

create table public.avisos_lidos (
  aviso_id text not null references public.avisos (id),
  colaborador_id text not null references public.colaboradores (id),
  lido_em timestamptz not null default now(),
  primary key (aviso_id, colaborador_id)
);

alter table public.avisos enable row level security;
create policy avisos_ver on public.avisos for select to authenticated using (public.e_gestao());
revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;

alter table public.avisos_lidos enable row level security;
create policy avisos_lidos_ver on public.avisos_lidos for select to authenticated using (public.e_gestao());
revoke all on public.avisos_lidos from anon, authenticated;
grant select on public.avisos_lidos to authenticated;

create trigger avisos_auditoria after insert or update or delete on public.avisos
  for each row execute function public.auditar();

create or replace function public.criar_aviso(p_titulo text, p_texto text, p_colaborador text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_titulo text := left(trim(coalesce(p_titulo, '')), 120);
  v_texto text := left(trim(coalesce(p_texto, '')), 1000);
  v_col text := nullif(trim(coalesce(p_colaborador, '')), '');
  v_id text;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if length(v_titulo) < 3 then
    raise exception 'Escreva o título do aviso (mínimo 3 letras).';
  end if;
  if length(v_texto) < 3 then
    raise exception 'Escreva o texto do aviso.';
  end if;
  if v_col is not null and not exists (select 1 from public.colaboradores where id = v_col and estado = 'Activo') then
    raise exception 'Colaborador não encontrado ou inactivo.';
  end if;
  insert into public.avisos (titulo, texto, colaborador_id, criado_por_nome)
  values (v_titulo, v_texto, v_col, public.nome_utilizador_actual())
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.criar_aviso(text, text, text) from public, anon;
grant execute on function public.criar_aviso(text, text, text) to authenticated;

create or replace function public.arquivar_aviso(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  update public.avisos set activo = false where id = p_id and activo;
  if not found then
    raise exception 'Aviso não encontrado ou já arquivado.';
  end if;
end;
$$;
revoke execute on function public.arquivar_aviso(text) from public, anon;
grant execute on function public.arquivar_aviso(text) to authenticated;

create or replace function public.meus_avisos()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_actual();
  v_res jsonb;
begin
  if v_col is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(t.x order by t.ord desc), '[]'::jsonb) into v_res
  from (
    select
      jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'data', a.criado_em,
                         'lido', l.aviso_id is not null) as x,
      a.criado_em as ord
    from (
      select * from public.avisos
      where activo and (colaborador_id is null or colaborador_id = v_col)
        and criado_em > now() - interval '30 days'
      order by criado_em desc limit 20
    ) a
    left join public.avisos_lidos l on l.aviso_id = a.id and l.colaborador_id = v_col
  ) t;
  return v_res;
end;
$$;
revoke execute on function public.meus_avisos() from public, anon;
grant execute on function public.meus_avisos() to authenticated;

create or replace function public.marcar_aviso_lido(p_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
begin
  if not exists (select 1 from public.avisos
                 where id = p_id and activo and (colaborador_id is null or colaborador_id = v_col)) then
    raise exception 'Aviso não encontrado.';
  end if;
  insert into public.avisos_lidos (aviso_id, colaborador_id) values (p_id, v_col)
  on conflict do nothing;
end;
$$;
revoke execute on function public.marcar_aviso_lido(text) from public, anon;
grant execute on function public.marcar_aviso_lido(text) to authenticated;

-- ===================== MEUS EQUIPAMENTOS =====================
create or replace function public.meus_equipamentos()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_actual();
begin
  if v_col is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'codigo', e.codigo, 'nome', e.nome, 'categoria', e.categoria,
      'estado', e.estado, 'data_aquisicao', e.data_aquisicao) order by e.nome)
    from public.equipamentos e
    where e.responsavel_id = v_col and e.estado <> 'Abatido'
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.meus_equipamentos() from public, anon;
grant execute on function public.meus_equipamentos() to authenticated;