-- Galedos Gestão · Ronda 3a: fecho do acesso aos preços, coordenadas dos clientes e distância

-- ===================== 1. PREÇOS: o colaborador deixa de ler a tabela de serviços =====================
drop policy servicos_ver_operacional on public.servicos;

-- ===================== 2. COORDENADAS DOS CLIENTES =====================
alter table public.clientes
  add column latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  add column longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  add constraint clientes_coordenadas_juntas check ((latitude is null) = (longitude is null));

-- ===================== 3. DISTÂNCIA MÁXIMA (editável) =====================
alter table public.config_presenca
  add column distancia_max_m integer not null default 500 check (distancia_max_m between 50 and 5000);

alter table public.execucoes_servico
  add column chegada_dist_m integer,
  add column inicio_dist_m integer,
  add column fim_dist_m integer;

create or replace function public.distancia_metros(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns integer language sql immutable set search_path = '' as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else round(2 * 6371000 * asin(least(1::double precision, sqrt(
           power(sin(radians((lat2 - lat1)::double precision) / 2), 2)
           + cos(radians(lat1::double precision)) * cos(radians(lat2::double precision))
           * power(sin(radians((lng2 - lng1)::double precision) / 2), 2)
         ))))::integer
  end;
$$;
revoke execute on function public.distancia_metros(numeric, numeric, numeric, numeric) from public, anon, authenticated;

create or replace function public.distancia_ao_cliente(p_servico text, p_lat numeric, p_lng numeric)
returns integer language sql stable security definer set search_path = '' as $$
  select public.distancia_metros(p_lat, p_lng, c.latitude, c.longitude)
  from public.servicos s
  join public.clientes c on c.id = s.cliente_id
  where s.id = p_servico;
$$;
revoke execute on function public.distancia_ao_cliente(text, numeric, numeric) from public, anon, authenticated;

create or replace function public.alterar_distancia_max(p_metros integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.e_admin() then
    raise exception 'Sem permissão para esta operação.';
  end if;
  if p_metros is null or p_metros < 50 or p_metros > 5000 then
    raise exception 'A distância deve estar entre 50 e 5000 metros.';
  end if;
  update public.config_presenca set distancia_max_m = p_metros, actualizado_em = now() where id = 1;
end;
$$;
revoke execute on function public.alterar_distancia_max(integer) from public, anon;
grant execute on function public.alterar_distancia_max(integer) to authenticated;

-- ===================== 4. EXECUÇÃO: guarda a distância ao cliente (sem bloquear) =====================
create or replace function public.marcar_chegada(p_servico text, p_lat numeric, p_lng numeric, p_precisao numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_obrigatorio();
  v_lat numeric := p_lat;
  v_lng numeric := p_lng;
  v_prec numeric := p_precisao;
  v_dist integer;
begin
  perform public.verificar_trabalho(p_servico, v_col);
  if exists (select 1 from public.execucoes_servico where servico_id = p_servico and colaborador_id = v_col) then
    raise exception 'Já marcou a chegada ou o início deste serviço.';
  end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    v_lat := null; v_lng := null; v_prec := null;
  end if;
  v_dist := public.distancia_ao_cliente(p_servico, v_lat, v_lng);
  insert into public.execucoes_servico (servico_id, colaborador_id, chegada_em, chegada_lat, chegada_lng, chegada_precisao, chegada_dist_m)
  values (p_servico, v_col, now(), v_lat, v_lng, v_prec, v_dist);
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
  v_dist integer;
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
  v_dist := public.distancia_ao_cliente(p_servico, v_lat, v_lng);

  select * into v_exec from public.execucoes_servico where servico_id = p_servico and colaborador_id = v_col for update;
  if found and v_exec.inicio_em is not null then
    raise exception 'Já iniciou este serviço.';
  end if;
  if found then
    update public.execucoes_servico
    set inicio_em = now(), inicio_lat = v_lat, inicio_lng = v_lng, inicio_precisao = v_prec, inicio_dist_m = v_dist
    where id = v_exec.id;
  else
    insert into public.execucoes_servico (servico_id, colaborador_id, inicio_em, inicio_lat, inicio_lng, inicio_precisao, inicio_dist_m)
    values (p_servico, v_col, now(), v_lat, v_lng, v_prec, v_dist);
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
  v_dist integer;
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
  v_dist := public.distancia_ao_cliente(p_servico, v_lat, v_lng);
  update public.execucoes_servico
  set fim_em = now(), fim_lat = v_lat, fim_lng = v_lng, fim_precisao = v_prec, fim_dist_m = v_dist, observacoes = v_obs
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