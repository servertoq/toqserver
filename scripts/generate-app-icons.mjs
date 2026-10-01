import sharp from "sharp";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Quanto maior, mais zoom no logo (recorte central menor antes do quadrado). */
const LOGO_ZOOM = 1.62;

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const dir = join(root, "public", "imagens_publicas");
const src = join(dir, "app-icon-source.png");

async function iconPipeline() {
  const meta = await sharp(src).metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;
  const side = Math.round(Math.min(w, h) / LOGO_ZOOM);
  const left = Math.max(0, Math.round((w - side) / 2));
  const top = Math.max(0, Math.round((h - side) / 2));
  const extractWidth = Math.min(side, w - left);
  const extractHeight = Math.min(side, h - top);

  return sharp(src).extract({
    left,
    top,
    width: extractWidth,
    height: extractHeight,
  });
}

const outputs = [
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["favicon.png", 32],
];

const base = await iconPipeline();

for (const [name, size] of outputs) {
  await base
    .clone()
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(join(dir, name));
}

await base.clone().resize(512, 512, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toFile(join(dir, "logo.jpg"));

console.log(`Ícones gerados (zoom ${LOGO_ZOOM}×) em public/imagens_publicas/`);
