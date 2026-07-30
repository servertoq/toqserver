import type { ClubRankingEntry } from "@/types/clubFeatures";

const REPORT_WIDTH = 1080;
const ROW_H = 72;
const HEADER_H = 200;
const FOOTER_H = 72;
const MAX_ROWS = 12;
const PAD_X = 48;

const COLORS = {
  bg: "#0a1830",
  bgAlt: "#0f2240",
  card: "#122848",
  accent: "#437df4",
  text: "#ffffff",
  muted: "#94a3b8",
  gold: "#f5c542",
  silver: "#c0c7d1",
  bronze: "#cd7f32",
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
  if (img) {
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(cx - r, cy - r, size, size);
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold ${Math.round(size * 0.4)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((username[0] ?? "?").toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
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

/** Gera banner JPEG do ranking (1080px) com logo Toq, posições, fotos e nomes. */
export async function generateClubRankingReportFile(
  input: ClubRankingReportInput
): Promise<File> {
  const rows = input.entries.slice(0, MAX_ROWS);
  const height = HEADER_H + rows.length * ROW_H + FOOTER_H + (rows.length ? 16 : 48);

  const canvas = document.createElement("canvas");
  canvas.width = REPORT_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar o relatório.");

  // Fundo
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#0a1830");
  grad.addColorStop(1, "#06101f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, REPORT_WIDTH, height);

  // Faixa superior accent
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, REPORT_WIDTH, 6);

  // Logo Toq
  const logo = await loadImageFromUrl("/imagens_publicas/logo_transp.png");
  if (logo) {
    const logoH = 56;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, PAD_X, 28, logoW, logoH);
  } else {
    ctx.fillStyle = COLORS.text;
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("TOQ TENNIS", PAD_X, 56);
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("RELATÓRIO DE RANKING", REPORT_WIDTH - PAD_X, 48);

  // Clube + categoria
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText(input.clubName.slice(0, 42), PAD_X, 120);

  ctx.fillStyle = COLORS.accent;
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.fillText(input.categoryName.slice(0, 48), PAD_X, 158);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillText(`Medido em: ${input.unitLabel}`, PAD_X, 184);

  // Avatar loads in parallel
  const avatars = await Promise.all(
    rows.map((e) =>
      e.profile?.avatar_url ? loadImageFromUrl(e.profile.avatar_url) : Promise.resolve(null)
    )
  );

  const y = HEADER_H;
  if (rows.length === 0) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sem pontuações nesta categoria.", REPORT_WIDTH / 2, y + 24);
  } else {
    rows.forEach((entry, index) => {
      const rank = index + 1;
      const rowY = y + index * ROW_H;
      const bg = index % 2 === 0 ? COLORS.card : COLORS.bgAlt;
      roundRect(ctx, PAD_X - 8, rowY, REPORT_WIDTH - PAD_X * 2 + 16, ROW_H - 8, 14);
      ctx.fillStyle = bg;
      ctx.fill();

      // Rank
      ctx.fillStyle = rankColor(rank);
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${rank}º`, PAD_X + 28, rowY + (ROW_H - 8) / 2);

      // Avatar
      const username = entry.profile?.username ?? "jogador";
      drawAvatar(ctx, avatars[index], username, PAD_X + 96, rowY + (ROW_H - 8) / 2, 48);

      // Name
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`@${username}`.slice(0, 28), PAD_X + 132, rowY + (ROW_H - 8) / 2);

      // Score
      ctx.fillStyle = COLORS.accent;
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(formatScore(entry.score), REPORT_WIDTH - PAD_X - 12, rowY + (ROW_H - 8) / 2 - 8);
      ctx.fillStyle = COLORS.muted;
      ctx.font = "500 12px system-ui, sans-serif";
      ctx.fillText(input.unitLabel, REPORT_WIDTH - PAD_X - 12, rowY + (ROW_H - 8) / 2 + 14);
    });
  }

  // Footer
  const footerY = height - FOOTER_H / 2;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, height - FOOTER_H, REPORT_WIDTH, FOOTER_H);
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 13px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  ctx.fillText(dateLabel, PAD_X, footerY);
  ctx.textAlign = "right";
  ctx.fillText("toqtennis.com.br", REPORT_WIDTH - PAD_X, footerY);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Falha ao exportar o relatório."))),
      "image/jpeg",
      0.92
    );
  });

  const slug = input.categoryName
    .toLowerCase()
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
