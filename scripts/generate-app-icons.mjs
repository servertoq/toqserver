import sharp from "sharp";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const dir = join(root, "public", "imagens_publicas");
const src = join(dir, "app-icon-source.png");

const outputs = [
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["favicon.png", 32],
];

for (const [name, size] of outputs) {
  await sharp(src)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(join(dir, name));
}

await sharp(src)
  .resize(512, 512, { fit: "cover", position: "centre" })
  .jpeg({ quality: 92 })
  .toFile(join(dir, "logo.jpg"));

console.log("Ícones gerados em public/imagens_publicas/");
