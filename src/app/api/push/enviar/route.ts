import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import webpush from "web-push";

function falha(mensagem: string, estado: number) {
  return NextResponse.json({ erro: mensagem }, { status: estado });
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chavePublica = Object.entries(process.env).find(([k]) => /^NEXT_PUBLIC_SUPABASE_(ANON|PUBLISHABLE)/.test(k))?.[1];
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivada = process.env.VAPID_PRIVATE_KEY;
  if (!url || !chavePublica) return falha("Configuração do servidor incompleta.", 500);
  if (!chaveServico) return falha("Falta a chave de serviço no servidor.", 500);
  if (!vapidPublica || !vapidPrivada) return falha("Faltam as chaves de notificação (VAPID) no servidor.", 500);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return falha("Sessão em falta.", 401);

  const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
  const publico = createClient(url, chavePublica, opcoes);
  const admin = createClient(url, chaveServico, opcoes);

  const { data: quem, error: erroSessao } = await publico.auth.getUser(token);
  if (erroSessao || !quem.user) return falha("Sessão inválida. Entre de novo.", 401);
  const { data: eu } = await admin.from("perfis").select("perfil,activo").eq("id", quem.user.id).maybeSingle();
  if (!eu || !eu.activo || (eu.perfil !== "administrador" && eu.perfil !== "gestao")) return falha("Sem permissão para esta operação.", 403);

  let avisoId = "";
  try {
    avisoId = String(((await req.json()) as { aviso_id?: string }).aviso_id ?? "");
  } catch {
    return falha("Pedido inválido.", 400);
  }
  if (!avisoId) return falha("Aviso em falta.", 400);

  const { data: aviso } = await admin
    .from("avisos")
    .select("id,titulo,texto,colaborador_id,activo,criado_em,push_enviado_em")
    .eq("id", avisoId)
    .maybeSingle();
  if (!aviso || !aviso.activo) return falha("Aviso não encontrado.", 404);
  if (aviso.push_enviado_em) return falha("As notificações deste aviso já foram enviadas.", 409);
  if (Date.now() - new Date(aviso.criado_em).getTime() > 15 * 60 * 1000) return falha("Este aviso é demasiado antigo para enviar notificações.", 400);

  // Reserva o envio (evita envios repetidos em simultâneo)
  const { data: reserva } = await admin
    .from("avisos")
    .update({ push_enviado_em: new Date().toISOString() })
    .eq("id", avisoId)
    .is("push_enviado_em", null)
    .select("id");
  if (!reserva || reserva.length === 0) return falha("As notificações deste aviso já foram enviadas.", 409);

  let consulta = admin.from("push_subscricoes").select("id,endpoint,p256dh,chave_auth,colaborador_id");
  if (aviso.colaborador_id) consulta = consulta.eq("colaborador_id", aviso.colaborador_id);
  const { data: subs } = await consulta.limit(1000);
  const { data: activos } = await admin.from("colaboradores").select("id").eq("estado", "Activo");
  const idsActivos = new Set((activos ?? []).map((c: { id: string }) => c.id));
  const alvo = (subs ?? []).filter((s: { colaborador_id: string }) => idsActivos.has(s.colaborador_id));

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? new URL(req.url).origin, vapidPublica, vapidPrivada);
  const carga = JSON.stringify({
    titulo: aviso.titulo,
    texto: String(aviso.texto).slice(0, 140),
    tag: "aviso-" + aviso.id,
    url: "/hoje",
  });

  const resultados = await Promise.allSettled(
    alvo.map((s: { endpoint: string; p256dh: string; chave_auth: string }) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.chave_auth } }, carga, { TTL: 86400 })
    )
  );

  let enviados = 0;
  const expirados: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") {
      enviados++;
    } else {
      const codigo = (r.reason as { statusCode?: number })?.statusCode;
      if (codigo === 404 || codigo === 410) expirados.push((alvo[i] as { id: string }).id);
    }
  });
  if (expirados.length > 0) await admin.from("push_subscricoes").delete().in("id", expirados);

  return NextResponse.json({ ok: true, enviados, falhados: alvo.length - enviados - expirados.length, removidos: expirados.length });
}