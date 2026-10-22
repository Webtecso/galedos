"use client";

import { useState } from "react";
import Link from "next/link";
import type { Cliente } from "@/lib/types";
import type { ClienteDados } from "./ClientesProvider";
import { MapPin } from "lucide-react";
import { mapaUrl, obterPosicao } from "@/lib/presenca";

const vazio: ClienteDados = {
  nome: "", tipo: "Particular", telefone: "", email: "", endereco: "",
  localizacao: "", nif: "", observacoes: "", estado: "Activo", latitude: null, longitude: null,
};

function extrair(c: Cliente): ClienteDados {
  return {
    nome: c.nome, tipo: c.tipo, telefone: c.telefone, email: c.email, endereco: c.endereco,
    localizacao: c.localizacao, nif: c.nif, observacoes: c.observacoes, estado: c.estado,
    latitude: c.latitude ?? null, longitude: c.longitude ?? null,
  };
}

const campo =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function ClienteForm({
  inicial,
  onSubmit,
  textoBotao,
  cancelarHref,
}: {
  inicial?: Cliente;
  onSubmit: (dados: ClienteDados) => void;
  textoBotao: string;
  cancelarHref: string;
}) {
  const [dados, setDados] = useState<ClienteDados>(inicial ? extrair(inicial) : vazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [aObter, setAObter] = useState(false);
  const [msgLoc, setMsgLoc] = useState("");

  async function usarLocalizacao() {
    setAObter(true);
    setMsgLoc("");
    const p = await obterPosicao();
    setAObter(false);
    if (p.lat === null || p.lng === null) {
      setMsgLoc("Não foi possível obter a localização. Permita o acesso à localização no navegador e tente de novo.");
      return;
    }
    setDados((d) => ({ ...d, latitude: p.lat, longitude: p.lng }));
    setMsgLoc("Localização preenchida. Clique em guardar para a gravar.");
  }

  function mudar<K extends keyof ClienteDados>(chave: K, valor: ClienteDados[K]) {
    setDados((d) => ({ ...d, [chave]: valor }));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (!dados.nome.trim()) novos.nome = "Indique o nome do cliente.";
    if (dados.telefone.replace(/\D/g, "").length < 9) novos.telefone = "Indique um telefone válido (mínimo 9 dígitos).";
    if (dados.email.trim() && !/^\S+@\S+\.\S+$/.test(dados.email.trim())) novos.email = "Correio electrónico inválido.";
    if (dados.tipo === "Empresa" && !dados.nif.trim()) novos.nif = "Indique o NIF da empresa.";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    onSubmit({
      ...dados,
      nome: dados.nome.trim(),
      telefone: dados.telefone.trim(),
      email: dados.email.trim(),
      endereco: dados.endereco.trim(),
      localizacao: dados.localizacao.trim(),
      nif: dados.tipo === "Empresa" ? dados.nif.trim() : "",
      observacoes: dados.observacoes.trim(),
    });
  }

  const empresa = dados.tipo === "Empresa";

  return (
    <form onSubmit={enviar} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Tipo de cliente *</label>
          <select className={campo} value={dados.tipo} onChange={(e) => mudar("tipo", e.target.value as ClienteDados["tipo"])}>
            <option value="Particular">Particular</option>
            <option value="Empresa">Empresa</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Estado</label>
          <select className={campo} value={dados.estado} onChange={(e) => mudar("estado", e.target.value as ClienteDados["estado"])}>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">
            {empresa ? "Denominação empresarial *" : "Nome completo *"}
          </label>
          <input className={campo} value={dados.nome} onChange={(e) => mudar("nome", e.target.value)} />
          {erros.nome && <p className="mt-1 text-xs text-red-600">{erros.nome}</p>}
        </div>

        {empresa && (
          <div>
            <label className="text-sm font-medium text-slate-700">NIF *</label>
            <input className={campo} value={dados.nif} onChange={(e) => mudar("nif", e.target.value)} />
            {erros.nif && <p className="mt-1 text-xs text-red-600">{erros.nif}</p>}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-slate-700">Telefone *</label>
          <input className={campo} placeholder="9XX XXX XXX" value={dados.telefone} onChange={(e) => mudar("telefone", e.target.value)} />
          {erros.telefone && <p className="mt-1 text-xs text-red-600">{erros.telefone}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Correio electrónico</label>
          <input className={campo} type="email" value={dados.email} onChange={(e) => mudar("email", e.target.value)} />
          {erros.email && <p className="mt-1 text-xs text-red-600">{erros.email}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Endereço habitual</label>
          <input className={campo} value={dados.endereco} onChange={(e) => mudar("endereco", e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Localização ou referência geográfica</label>
          <input className={campo} placeholder="Ex.: Talatona, perto do Shopping" value={dados.localizacao} onChange={(e) => mudar("localizacao", e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Coordenadas do local</label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button type="button" onClick={usarLocalizacao} disabled={aObter} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <MapPin className="h-4 w-4" /> {aObter ? "A obter..." : "Usar a minha localização actual"}
            </button>
            {dados.latitude != null && dados.longitude != null && (
              <>
                <a href={mapaUrl(dados.latitude, dados.longitude)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 hover:underline">{dados.latitude}, {dados.longitude} (ver mapa)</a>
                <button type="button" onClick={() => setDados((d) => ({ ...d, latitude: null, longitude: null }))} className="text-sm text-red-700 hover:underline">Limpar</button>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Use o botão quando estiver no local do cliente. Serve para assinalar, sem bloquear, quando um serviço é iniciado longe do local.</p>
          {msgLoc && <p className="mt-1 text-xs text-slate-600">{msgLoc}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">Observações</label>
          <textarea className={campo} rows={3} value={dados.observacoes} onChange={(e) => mudar("observacoes", e.target.value)} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
        <Link href={cancelarHref} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Cancelar
        </Link>
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {textoBotao}
        </button>
      </div>
    </form>
  );
}