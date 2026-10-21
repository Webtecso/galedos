type ErroBd = { code?: string; message?: string } | null | undefined;

export function traduzirErro(e: ErroBd): string {
  if (!e) return "Não foi possível concluir a operação.";
  const m = e.message ?? "";
  if (e.code === "P0001") return m;
  if (e.code === "42501" || m.includes("row-level security")) return "Sem permissão para esta operação.";
  if (e.code === "PGRST116") return "Sem permissão para esta operação, ou o registo já não existe.";
  if (e.code === "23514") return "Dados inválidos. Verifique os valores indicados.";
  if (e.code === "23505") return "Já existe um registo igual (duplicado).";
  if (e.code === "23503") return "O registo associado não existe ou está em utilização.";
  return "Não foi possível concluir: " + m;
}