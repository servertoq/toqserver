/** Capa padrão de comunidades e clubes (3:1 — horizontal) */
export const COMMUNITY_COVER_WIDTH = 1200;
export const COMMUNITY_COVER_HEIGHT = 400;

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const COMMUNITY_COVER_HINT =
  "Use uma foto horizontal (ideal 3:1, ex.: 1200×400 px). A imagem inteira será ajustada sem cortes.";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

/** Redimensiona e centraliza a capa em 1200×400 sem cortar o conteúdo. */
export async function prepareCommunityCoverFile(file: File): Promise<File> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error("Formato inválido. Use JPG, PNG ou WebP.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("A imagem deve ter no máximo 10 MB.");
  }

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = COMMUNITY_COVER_WIDTH;
  canvas.height = COMMUNITY_COVER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");

  ctx.fillStyle = "#0a1830";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;
  ctx.drawImage(img, x, y, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Falha ao exportar a imagem."))),
      "image/jpeg",
      0.88,
    );
  });

  return new File([blob], "cover.jpg", { type: "image/jpeg" });
}

export async function processCommunityCoverSelection(file: File): Promise<{
  file: File;
  previewUrl: string;
}> {
  const prepared = await prepareCommunityCoverFile(file);
  return { file: prepared, previewUrl: URL.createObjectURL(prepared) };
}
