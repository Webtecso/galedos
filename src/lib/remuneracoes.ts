import type {
  ColaboradorCompleto, ConfigRemuneracao, EstadoRemuneracao, PagamentoColaborador, Remuneracao,
} from "./types";

export const modalidadesDistribuicao = ["Divisão igual", "Percentagens individuais", "Quotas por serviço"] as const;

export type LinhaDistribuicao = { colaboradorId: string; percentagem: number; valor: number };
export type ResultadoDistribuicao = { linhas: LinhaDistribuicao[]; regra: string; aviso?: string };

export function distribuir(
  valorElegivel: number,
  equipa: ColaboradorCompleto[],
  config: ConfigRemuneracao,
  quotas?: Record<string, number>
): ResultadoDistribuicao {
  if (equipa.length === 0) return { linhas: [], regra: "", aviso: "sem equipa atribuída" };

  if (config.modalidade === "Divisão igual") {
    const total = Math.round((valorElegivel * config.percentagemEquipa) / 100);
    const base = Math.floor(total / equipa.length);
    let resto = total - base * equipa.length;
    const linhas = equipa.map((c) => {
      const extra = resto > 0 ? 1 : 0;
      if (resto > 0) resto--;
      return {
        colaboradorId: c.id,
        percentagem: config.percentagemEquipa / equipa.length,
        valor: base + extra,
      };
    });
    return { linhas, regra: `Divisão igual · equipa ${config.percentagemEquipa}%` };
  }

  if (config.modalidade === "Quotas por serviço") {
    if (!quotas)
      return { linhas: [], regra: "", aviso: "modalidade Quotas por serviço sem quotas definidas (Remunerações > Quotas por serviço)" };
    const ids = equipa.map((c) => c.id);
    const chaves = Object.keys(quotas);
    if (ids.length !== chaves.length || !ids.every((id) => id in quotas))
      return { linhas: [], regra: "", aviso: "as quotas definidas já não correspondem à equipa actual" };
    const soma = ids.reduce((t, id) => t + quotas[id], 0);
    if (Math.abs(soma - 100) > 0.01)
      return { linhas: [], regra: "", aviso: `as quotas somam ${Math.round(soma * 100) / 100}% (devem somar 100%)` };

    const total = Math.round((valorElegivel * config.percentagemEquipa) / 100);
    const base = ids.map((id) => Math.floor((total * quotas[id]) / soma));
    let resto = total - base.reduce((a, b) => a + b, 0);
    for (let i = 0; resto > 0; i = (i + 1) % base.length) {
      base[i] += 1;
      resto -= 1;
    }
    const linhas = equipa.map((c, i) => ({
      colaboradorId: c.id,
      percentagem: (config.percentagemEquipa * quotas[c.id]) / soma,
      valor: base[i],
    }));
    return { linhas, regra: `Quotas por serviço · equipa ${config.percentagemEquipa}%` };
  }

  const semPct = equipa.filter((c) => !(c.percentagem > 0));
  if (semPct.length > 0)
    return { linhas: [], regra: "", aviso: `sem percentagem individual: ${semPct.map((c) => c.nome).join(", ")}` };
  const soma = equipa.reduce((t, c) => t + c.percentagem, 0);
  if (soma > 100) return { linhas: [], regra: "", aviso: `a soma das percentagens da equipa (${soma}%) excede 100%` };
  const linhas = equipa.map((c) => ({
    colaboradorId: c.id,
    percentagem: c.percentagem,
    valor: Math.round((valorElegivel * c.percentagem) / 100),
  }));
  return { linhas, regra: "Percentagens individuais" };
}

export type Saldo = { apurado: number; aprovado: number; pago: number; saldo: number };

export function saldoColaborador(
  colaboradorId: string,
  remuneracoes: Remuneracao[],
  pagamentos: PagamentoColaborador[]
): Saldo {
  const minhas = remuneracoes.filter((r) => r.colaboradorId === colaboradorId);
  const apurado = minhas.reduce((t, r) => t + r.valor, 0);
  const aprovado = minhas.filter((r) => r.aprovada).reduce((t, r) => t + r.valor, 0);
  const pago = pagamentos.filter((p) => p.colaboradorId === colaboradorId).reduce((t, p) => t + p.valor, 0);
  return { apurado, aprovado, pago, saldo: aprovado - pago };
}

export function estadosRemuneracao(
  remuneracoes: Remuneracao[],
  pagamentos: PagamentoColaborador[]
): Record<string, EstadoRemuneracao> {
  const out: Record<string, EstadoRemuneracao> = {};
  const ids = Array.from(new Set(remuneracoes.map((r) => r.colaboradorId)));
  for (const cid of ids) {
    let pool = pagamentos.filter((p) => p.colaboradorId === cid).reduce((t, p) => t + p.valor, 0);
    const lista = remuneracoes
      .filter((r) => r.colaboradorId === cid)
      .sort((a, b) => (a.data + a.id).localeCompare(b.data + b.id));
    for (const r of lista) {
      if (!r.aprovada) {
        out[r.id] = "Apurada";
      } else if (r.valor <= 0) {
        out[r.id] = "Aprovada";
      } else {
        const tomar = Math.min(pool, r.valor);
        pool -= tomar;
        out[r.id] = tomar >= r.valor ? "Paga" : tomar > 0 ? "Parcialmente paga" : "Aprovada";
      }
    }
  }
  return out;
}