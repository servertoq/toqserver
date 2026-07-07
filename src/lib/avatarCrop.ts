export const AVATAR_VIEWPORT_SIZE = 280;
export const AVATAR_OUTPUT_SIZE = 512;

export type AvatarCropState = {
  /** Multiplicador sobre o zoom base (cobre o círculo) */
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function getBaseCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number
) {
  return Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
}

export function getDisplayScale(
  image: HTMLImageElement,
  crop: AvatarCropState,
  viewportSize = AVATAR_VIEWPORT_SIZE
) {
  const base = getBaseCoverScale(image.naturalWidth, image.naturalHeight, viewportSize);
  return base * crop.scale;
}

export async function renderCroppedAvatarFile(
  image: HTMLImageElement,
  crop: AvatarCropState,
  viewportSize = AVATAR_VIEWPORT_SIZE,
  outputSize = AVATAR_OUTPUT_SIZE,
  fileName = "avatar.jpg"
): Promise<File> {
  const displayScale = getDisplayScale(image, crop, viewportSize);
  const cropSizeInImage = viewportSize / displayScale;
  const sx =
    image.naturalWidth / 2 - cropSizeInImage / 2 - crop.offsetX / displayScale;
  const sy =
    image.naturalHeight / 2 - cropSizeInImage / 2 - crop.offsetY / displayScale;

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  ctx.drawImage(image, sx, sy, cropSizeInImage, cropSizeInImage, 0, 0, outputSize, outputSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao gerar imagem"));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}
