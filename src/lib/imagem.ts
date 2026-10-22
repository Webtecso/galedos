export async function reduzirImagem(ficheiro: File, maximo = 1280, qualidade = 0.72): Promise<Blob> {
  let bitmap: ImageBitmap | null = null;
  let url = "";
  let fonte: CanvasImageSource;
  let largura = 0;
  let altura = 0;

  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(ficheiro, { imageOrientation: "from-image" });
    } catch {
      bitmap = null;
    }
  }

  if (bitmap) {
    fonte = bitmap;
    largura = bitmap.width;
    altura = bitmap.height;
  } else {
    url = URL.createObjectURL(ficheiro);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Imagem inválida."));
      i.src = url;
    });
    fonte = img;
    largura = img.naturalWidth;
    altura = img.naturalHeight;
  }

  try {
    if (!largura || !altura) throw new Error("Imagem inválida.");
    const escala = Math.min(1, maximo / Math.max(largura, altura));
    const w = Math.max(1, Math.round(largura * escala));
    const h = Math.max(1, Math.round(altura * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    ctx.drawImage(fonte, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
    if (!blob) throw new Error("Não foi possível comprimir a imagem.");
    return blob;
  } finally {
    if (bitmap) bitmap.close();
    if (url) URL.revokeObjectURL(url);
  }
}