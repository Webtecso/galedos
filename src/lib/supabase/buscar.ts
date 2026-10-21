import { getSupabase } from "./client";

export async function buscarTudo<T>(tabela: string, ordem: string): Promise<{ data: T[]; error: string | null }> {
  const sb = getSupabase();
  const todos: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select("*").order(ordem).order("id").range(de, de + 999);
    if (error) return { data: [], error: error.message };
    const pagina = (data ?? []) as unknown as T[];
    todos.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return { data: todos, error: null };
}