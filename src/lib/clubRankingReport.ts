import type { ClubRankingEntry } from "@/types/clubFeatures";

/** Formato 4:5 — encaixa no feed e no Instagram sem esticar. */
const W = 1080;
const H = 1350;
const PAD = 48;
const MAX_ROWS = 15;

const COLORS = {
  bg0: "#07111f",
  bg1: "#0c1c36",
  row: "#132#if",
  rowAlt: "#0f2444",
  accent: "#3b82f6",
  accentSoft: "rgba(59, 130, 246, 0.18)",
  text: "#ffffff",
  muted: "#94a3b8",
  gold: "#f5c542",
  silver: "#c0c7d1",
  bronze: "#cd7f32",
  line: "rgba(255,255,255,0.08)",
};

function loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  username: string,
  cx: number,
  cy: number,
  size: number
) {
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img && img.width > 0 && img.height > 0) {
    const scale = Math.max(size / img.width, size / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(cx - r, cy - r, size, size);
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 ${Math.round(size * 0.42)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((username[0] ?? "?").toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function rankColor(rank: number) {
  if (rank === 1) return COLORS.gold;
  if (rank === 2) return COLORS.silver;
  if (rank === 3) return COLORS.bronze;
  return COLORS.muted;
}

function formatScore(score: number) {
  return Number.isInteger(score)
    ? String(score)
    : score.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export type ClubRankingReportInput = {
  clubName: string;
  categoryName: string;
  unitLabel: string;
  entries: ClubRankingEntry[];
};

/** Gera imagem JPEG 1080×1350 (4:5) do ranking. */
export async function generateClubRankingReportFile(
  input: ClubRankingReportInput
): Promise<File> {
  const rows = input.entries.slice(0, MAX_ROWS);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar o relatório.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Fundo
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COLORS.bg1);
  grad.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Glow decorativo
  const glow = ctx.createRadialGradient(W * 0.85, 80, 20, W * 0.85, 80, 320);
  glow.addColorStop(0, "rgba(59,130,246,0.28)");
  glow.addColorStop(1, "rgba(59,130,246,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 420);

  // Barra superior
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, W, 8);

  // Marca TOQ (texto — logo mask não serve bem no canvas)
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 34px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("TOQ", PAD, 56);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "700 14px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("RELATÓRIO DE RANKING", W - PAD, 56);

  // Título
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  ctx.font = "800 48px Inter, system-ui, sans-serif";
  const clubTitle = truncate(ctx, input.clubName.trim() || "Clube", W - PAD * 2);
  ctx.fillText(clubTitle, PAD, 128);

  ctx.fillStyle = COLORS.accent;
  ctx.font = "700 28px Inter, system-ui, sans-serif";
  ctx.fillText(truncate(ctx, input.categoryName, W - PAD * 2), PAD, 178);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 18px Inter, system-ui, sans-serif";
  ctx.fillText(`Medido em: ${input.unitLabel}`, PAD, 214);

  // Linha divisória
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 248);
  ctx.lineTo(W - PAD, 248);
  ctx.stroke();

  const listTop = 272;
  const footerH = 88;
  const listBottom = H - footerH - 24;
  const listH = listBottom - listTop;

  const avatars = await Promise.all(
    rows.map((e) =>
      e.profile?.avatar_url ? loadImageFromUrl(e.profile.avatar_url) : Promise.resolve(null)
    )
  );

  if (rows.length === 0) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sem pontuações nesta categoria.", W / 2, listTop + listH / 2);
  } else {
    const gap = 12;
    const rowH = Math.min(96, Math.max(68, (listH - gap * (rows.length - 1)) / rows.length));
    const blockH = rows.length * rowH + (rows.length - 1) * gap;
    let y = listTop + Math.max(0, (listH - blockH) / 2);

    rows.forEach((entry, index) => {
      const rank = index + 1;
      const username = entry.profile?.username ?? "jogador";

      roundRect(ctx, PAD, y, W - PAD * 2, rowH, 18);
      ctx.fillStyle = index % 2 === 0 ? "#152a4d" : "#102240";
      ctx.fill();

      // Faixa de rank
      roundRect(ctx, PAD, y, 10, rowH, 18);
      ctx.fillStyle = rankColor(rank);
      ctx.fill();
      // cobrir cantos direitos da faixa
      ctx.fillRect(PAD + 5, y, 5, rowH);

      const midY = y + rowH / 2;

      ctx.fillStyle = rankColor(rank);
      ctx.font = "800 26px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rank}º`, PAD + 52, midY);

      const avatarSize = Math.min(56, rowH - 20);
      drawAvatar(ctx, avatars[index], username, PAD + 118, midY, avatarSize);

      const scoreText = formatScore(entry.score);
      ctx.font = "800 28px Inter, system-ui, sans-serif";
      const scoreW = ctx.measureText(scoreText).width;
      ctx.font = "600 14px Inter, system-ui, sans-serif";
      const unitW = ctx.measureText(input.unitLabel).width;
      const rightBlock = Math.max(scoreW, unitW) + 28;

      ctx.fillStyle = COLORS.text;
      ctx.font = "700 24px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      const nameMax = W - PAD - 150 - rightBlock - 16;
      ctx.fillText(truncate(ctx, `@${username}`, nameMax), PAD + 156, midY);

      ctx.fillStyle = COLORS.accent;
      ctx.font = "800 28px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(scoreText, W - PAD - 24, midY - 10);

      ctx.fillStyle = COLORS.muted;
      ctx.font = "600 14px Inter, system-ui, sans-serif";
      ctx.fillText(input.unitLabel, W - PAD - 24, midY + 16);

      y += rowH + gap;
    });
  }

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, H - footerH, W, footerH);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 16px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  ctx.fillText(dateLabel, PAD, H - footerH / 2);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.text;
  ctx.font = "700 16px Inter, system-ui, sans-serif";
  ctx.fillText("toqtennis.com.br", W - PAD, H - footerH / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Falha ao exportar o relatório."))),
      "image/jpeg",
      0.94
    );
  });

  const slug = input.categoryName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return new File([blob], `ranking-${slug || "clube"}.jpg`, { type: "image/jpeg" });
}

export function downloadClubRankingReport(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}
