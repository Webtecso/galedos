const FUSO = "Africa/Luanda";

export type Pausa = { id: string; inicio_em: string; fim_em: string | null };

export type Presenca = {
  id: string;
  colaborador_id: string;
  data: string;
  entrada_em: string;
  saida_em: string | null;
  entrada_lat: number | null;
  entrada_lng: number | null;
  saida_lat: number | null;
  saida_lng: number | null;
  atraso_min: number;
  validada: boolean;
  validada_por: string;
  motivo_correccao: string;
  pausas_presenca: Pausa[] | null;
};

export type Execucao = {
  id: string;
  servico_id: string;
  colaborador_id: string;
  chegada_em: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  inicio_lat: number | null;
  inicio_lng: number | null;
  fim_lat: number | null;
  fim_lng: number | null;
  chegada_dist_m: number | null;
  inicio_dist_m: number | null;
  fim_dist_m: number | null;
  observacoes: string;
  motivo_correccao: string;
  servicos?: { codigo: string; tipo_servico: string; duracao_min: number } | null;
};

export type ConfigPresenca = {
  hora_entrada: string;
  hora_saida: string;
  tolerancia_min: number;
  janela_inicio_min: number;
  distancia_max_m: number;
};

export function dataLuanda(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function horaLuanda(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export function minutosEntre(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

export function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

export function minutosPausas(p: Presenca, fimMs: number): number {
  return (p.pausas_presenca ?? []).reduce((t, x) => {
    const ini = new Date(x.inicio_em).getTime();
    const fim = x.fim_em ? new Date(x.fim_em).getTime() : fimMs;
    return t + Math.max(0, Math.round((fim - ini) / 60000));
  }, 0);
}

export function minutosTrabalhados(p: Presenca, agoraMs: number): number {
  const fim = p.saida_em ? new Date(p.saida_em).getTime() : agoraMs;
  const bruto = Math.max(0, Math.round((fim - new Date(p.entrada_em).getTime()) / 60000));
  return Math.max(0, bruto - minutosPausas(p, fim));
}

export function paraMinutosDia(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function proximoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export function inicioMesISO(mes: string): string {
  return new Date(`${mes}-01T00:00:00+01:00`).toISOString();
}

export function paraISO(data: string, hhmm: string): string {
  return new Date(`${data}T${hhmm}:00+01:00`).toISOString();
}

export function mapaUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export type Posicao = { lat: number | null; lng: number | null; precisao: number | null };

export function obterPosicao(): Promise<Posicao> {
  const vazio: Posicao = { lat: null, lng: null, precisao: null };
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(vazio);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: Math.round(p.coords.latitude * 1e6) / 1e6,
          lng: Math.round(p.coords.longitude * 1e6) / 1e6,
          precisao: Math.round(p.coords.accuracy * 10) / 10,
        }),
      () => resolve(vazio),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}