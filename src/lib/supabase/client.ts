import { createBrowserClient } from "@supabase/ssr";

let cliente: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !chave) {
      throw new Error("Falta configurar o Supabase (.env.local). Reinicie o servidor com npm run dev.");
    }
    cliente = createBrowserClient(url, chave);
  }
  return cliente;
}