import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type Corpo = {
  accao?: "criar" | "repor";
  colaborador_id?: string;
  email?: string;
  password?: string;
  user_id?: string;
};

function falha(mensagem: string, estado: number) {
  return NextResponse.json({ erro: mensagem }, { status: estado });
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chavePublica = Object.entries(process.env).find(([k]) => /^NEXT_PUBLIC_SUPABASE_(ANON|PUBLISHABLE)/.test(k))?.[1];
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chavePublica) return falha("Configuração do servidor incompleta.", 500);
  if (!chaveServico) return falha("Falta a chave de serviço no servidor (SUPABASE_SERVICE_ROLE_KEY na Netlify).", 500);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return falha("Sessão em falta.", 401);

  const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
  const publico = createClient(url, chavePublica, opcoes);
  const admin = createClient(url, chaveServico, opcoes);

  const { data: quem, error: erroSessao } = await publico.auth.getUser(token);
  if (erroSessao || !quem.user) return falha("Sessão inválida. Entre de novo.", 401);
  const { data: eu } = await admin.from("perfis").select("perfil,activo").eq("id", quem.user.id).maybeSingle();
  if (!eu || eu.perfil !== "administrador" || !eu.activo) return falha("Sem permissão para esta operação.", 403);

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return falha("Pedido inválido.", 400);
  }

  const password = String(corpo.password ?? "");
  if (password.length < 8 || password.length > 72) return falha("A palavra-passe deve ter entre 8 e 72 caracteres.", 400);

  if (corpo.accao === "repor") {
    const alvo = String(corpo.user_id ?? "");
    if (!alvo) return falha("Conta em falta.", 400);
    const { data: existe } = await admin.from("perfis").select("id").eq("id", alvo).maybeSingle();
    if (!existe) return falha("Conta não encontrada.", 404);
    const { error } = await admin.auth.admin.updateUserById(alvo, { password });
    if (error) return falha("Não foi possível alterar a palavra-passe.", 500);
    // Quem recebe uma palavra-passe de outra pessoa tem de a mudar no primeiro acesso
    await admin.from("perfis").update({ deve_mudar_password: alvo !== quem.user.id }).eq("id", alvo);
    return NextResponse.json({ ok: true });
  }

  if (corpo.accao === "criar") {
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const colaboradorId = String(corpo.colaborador_id ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return falha("Email inválido.", 400);
    if (!colaboradorId) return falha("Seleccione o colaborador.", 400);

    const { data: colab } = await admin.from("colaboradores").select("id,nome,estado").eq("id", colaboradorId).maybeSingle();
    if (!colab) return falha("Colaborador não encontrado.", 404);
    if (colab.estado !== "Activo") return falha("O colaborador não está activo.", 400);
    const { data: jaLigado } = await admin.from("perfis").select("id").eq("colaborador_id", colaboradorId).maybeSingle();
    if (jaLigado) return falha("Este colaborador já tem conta.", 409);

    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (erroCriar || !criado.user) {
      const jaExiste = /already|registered|exists/i.test(erroCriar?.message ?? "");
      return falha(jaExiste ? "Este email já está registado." : "Não foi possível criar a conta.", jaExiste ? 409 : 500);
    }
    const uid = criado.user.id;

    const campos = { colaborador_id: colab.id, nome: colab.nome, perfil: "operacional", activo: true, deve_mudar_password: true };
    const { data: actualizados, error: erroAct } = await admin.from("perfis").update(campos).eq("id", uid).select("id");
    let ligado = !erroAct && (actualizados?.length ?? 0) > 0;
    if (!ligado && !erroAct) {
      const { error: erroIns } = await admin.from("perfis").insert({ id: uid, email, ...campos });
      ligado = !erroIns;
    }
    if (!ligado) {
      await admin.auth.admin.deleteUser(uid);
      return falha("Não foi possível ligar a conta ao colaborador. Nada foi criado.", 500);
    }
    return NextResponse.json({ ok: true, user_id: uid });
  }

  return falha("Acção inválida.", 400);
}