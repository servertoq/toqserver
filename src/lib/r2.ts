import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = process.env.R2_BUCKET_NAME?.trim() || "toq-tennis";
  const publicUrl = (
    process.env.R2_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ||
    ""
  ).replace(/\/$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error(
      "R2 não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_PUBLIC_URL (ou NEXT_PUBLIC_R2_PUBLIC_URL)."
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

export function isR2Configured() {
  try {
    getR2Config();
    return true;
  } catch {
    return false;
  }
}

let cachedClient: S3Client | null = null;

export function getR2Client() {
  if (cachedClient) return cachedClient;
  const cfg = getR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // Evita x-amz-checksum-* que quebra PUT no browser / R2
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cachedClient;
}

export function r2PublicUrlForKey(key: string) {
  const { publicUrl } = getR2Config();
  const clean = key.replace(/^\//, "");
  return `${publicUrl}/${clean}`;
}

/** Extrai a key a partir da URL pública do R2 (com ou sem query). */
export function r2KeyFromPublicUrl(url: string): string | null {
  try {
    const cfg = getR2Config();
    const base = cfg.publicUrl.replace(/\/$/, "");
    const clean = url.split("?")[0] ?? url;
    if (!clean.startsWith(base + "/")) return null;
    return decodeURIComponent(clean.slice(base.length + 1));
  } catch {
    return null;
  }
}

export async function createR2PresignedPut(opts: {
  key: string;
  contentType: string;
  expiresIn?: number;
}) {
  const cfg = getR2Config();
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: opts.expiresIn ?? 600,
  });
  return {
    uploadUrl,
    key: opts.key,
    publicUrl: r2PublicUrlForKey(opts.key),
  };
}

export async function deleteR2Object(key: string) {
  const cfg = getR2Config();
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
    })
  );
}
