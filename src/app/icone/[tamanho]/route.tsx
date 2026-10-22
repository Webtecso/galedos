import { ImageResponse } from "next/og";

const permitidos = [180, 192, 512];

export async function GET(_req: Request, { params }: { params: Promise<{ tamanho: string }> }) {
  const { tamanho } = await params;
  const n = Number(tamanho);
  if (!permitidos.includes(n)) return new Response("Não encontrado", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1b3a",
          color: "#ffffff",
          fontSize: Math.round(n * 0.52),
          fontWeight: 700,
        }}
      >
        G
      </div>
    ),
    { width: n, height: n }
  );
}