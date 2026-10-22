-- Galedos Gestão · Ronda 4a: valor_elegivel, percentagem e regra só para a administração

drop policy remuneracoes_ver on public.remuneracoes;
create policy remuneracoes_ver on public.remuneracoes for select to authenticated using (public.e_admin());

create or replace function public.minhas_remuneracoes()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_col text := public.colaborador_actual();
begin
  if v_col is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'tipo', r.tipo,
      'servico_codigo', r.servico_codigo,
      'valor', r.valor,
      'data', r.data,
      'periodo', r.periodo,
      'aprovada', r.aprovada,
      'motivo', r.motivo
    ) order by r.data desc, r.criado_em desc)
    from public.remuneracoes r
    where r.colaborador_id = v_col
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.minhas_remuneracoes() from public, anon;
grant execute on function public.minhas_remuneracoes() to authenticated;