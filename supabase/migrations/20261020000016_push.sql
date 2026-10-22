-- Galedos Gestão · Ronda 5: notificações push

create table public.push_subscricoes (
  id text primary key default gen_random_uuid()::text,
  endpoint text not null unique check (length(endpoint) between 20 and 700 and endpoint like 'https://%'),
  p256dh text not null check (length(p256dh) between 20 and 200),
  chave_auth text not null check (length(chave_auth) between 8 and 100),
  colaborador_id text not null references public.colaboradores (id),
  user_id uuid not null,
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now()
);
create index push_subscricoes_colab_idx on public.push_subscricoes (colaborador_id);

-- Sem políticas e sem permissões: só o servidor (chave de serviço) lê esta tabela
alter table public.push_subscricoes enable row level security;
revoke all on public.push_subscricoes from anon, authenticated;

alter table public.avisos add column push_enviado_em timestamptz;

create or replace function public.guardar_subscricao(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
begin
  if p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint) > 700 then
    raise exception 'Subscrição inválida.';
  end if;
  if p_p256dh is null or p_auth is null then
    raise exception 'Subscrição inválida.';
  end if;
  insert into public.push_subscricoes (endpoint, p256dh, chave_auth, colaborador_id, user_id)
  values (p_endpoint, p_p256dh, p_auth, v_col, (select auth.uid()))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, chave_auth = excluded.chave_auth,
        colaborador_id = excluded.colaborador_id, user_id = excluded.user_id, actualizado_em = now();
  -- no máximo 5 dispositivos por colaborador
  delete from public.push_subscricoes
  where colaborador_id = v_col
    and id not in (select id from public.push_subscricoes where colaborador_id = v_col order by actualizado_em desc limit 5);
end;
$$;
revoke execute on function public.guardar_subscricao(text, text, text) from public, anon;
grant execute on function public.guardar_subscricao(text, text, text) to authenticated;