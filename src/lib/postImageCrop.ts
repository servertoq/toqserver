export type ImageCropState = {
  /** Multiplicador sobre o zoom base (cobre o viewport) */
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type PostCropAspect = {
  id: string;
  label: string;
  /** largura / altura */
  ratio: number;
};

export const POST_CROP_ASPECTS: PostCropAspect[] = [
  { id: "landscape", label: "Paisagem", ratio: 16 / 9 },
  { id: "square", label: "Quadrado", ratio: 1 },
  { id: "portrait", label: "Retrato", ratio: 4 / 5 },
];

/** Largura máxima do viewport na UI (px). */
export const POST_CROP_VIEWPORT_MAX_W = 340;

export function pickDefaultPostCropAspect(naturalWidth: number, naturalHeight: number): PostCropAspect {
  const r = naturalWidth / Math.max(naturalHeight, 1);
  if (r >= 1.25) return POST_CROP_ASPECTS[0]; // paisagem
  if (r <= 0.85) return POST_CROP_ASPECTS[2]; // retrato
  return POST_CROP_ASPECTS[1]; // quadrado
}

export function postCropViewportSize(ratio: number, maxW = POST_CROP_VIEWPORT_MAX_W) {
  const width = maxW;
  const height = Math.round(maxW / ratio);
  return { width, height };
}

export function getBaseCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  viewportW: number,
  viewportH: number
) {
  const w = Math.max(naturalWidth, 1);
  const h = Math.max(naturalHeight, 1);
  return Math.max(viewportW / w, viewportH / h);
}

export function getPostCropDisplayScale(
  image: HTMLImageElement,
  crop: ImageCropState,
  viewportW: number,
  viewportH: number
) {
  const base = getBaseCoverScale(image.naturalWidth, image.naturalHeight, viewportW, viewportH);
  return base * crop.scale;
}

export async function renderCroppedPostImageFile(
  image: HTMLImageElement,
  crop: ImageCropState,
  viewportW: number,
  viewportH: number,
  fileName = "post-image.jpg"
): Promise<File> {
  const displayScale = getPostCropDisplayScale(image, crop, viewportW, viewportH);
  const cropWInImage = viewportW / displayScale;
  const cropHInImage = viewportH / displayScale;
  const sx = image.naturalWidth / 2 - cropWInImage / 2 - crop.offsetX / displayScale;
  const sy = image.naturalHeight / 2 - cropHInImage / 2 - crop.offsetY / displayScale;

  // Saída na resolução real do recorte na foto (não no viewport da UI).
  const maxSide = 4096;
  let outW = Math.max(1, Math.round(cropWInImage));
  let outH = Math.max(1, Math.round(cropHInImage));
  const longest = Math.max(outW, outH);
  if (longest > maxSide) {
    const scale = maxSide / longest;
    outW = Math.max(1, Math.round(outW * scale));
    outH = Math.max(1, Math.round(outH * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, cropWInImage, cropHInImage, 0, 0, outW, outH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao gerar imagem"));
          return;
        }
        resolve(new File([blob], fileName.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.95
    );
  });
}
