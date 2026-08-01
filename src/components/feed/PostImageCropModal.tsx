"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getPostCropDisplayScale,
  pickDefaultPostCropAspect,
  POST_CROP_ASPECTS,
  postCropViewportSize,
  renderCroppedPostImageFile,
  type ImageCropState,
  type PostCropAspect,
} from "@/lib/postImageCrop";

type Props = {
  open: boolean;
  imageSrc: string;
  onConfirm: (file: File, previewUrl: string) => void;
  /** Usa a imagem sem recortar (mostra inteira no post). */
  onSkip?: () => void;
  onCancel: () => void;
};

export function PostImageCropModal({ open, imageSrc, onConfirm, onSkip, onCancel }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [crop, setCrop] = useState<ImageCropState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [aspect, setAspect] = useState<PostCropAspect>(POST_CROP_ASPECTS[0]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ scale: 1, offsetX: 0, offsetY: 0 });
    setReady(false);
  }, [open, imageSrc]);

  const viewport = useMemo(() => postCropViewportSize(aspect.ratio), [aspect.ratio]);

  useEffect(() => {
    setCrop({ scale: 1, offsetX: 0, offsetY: 0 });
  }, [aspect.id]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: crop.offsetX,
        oy: crop.offsetY,
      };
    },
    [crop.offsetX, crop.offsetY]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setCrop((prev) => ({
      ...prev,
      offsetX: dragRef.current!.ox + (e.clientX - dragRef.current!.x),
      offsetY: dragRef.current!.oy + (e.clientY - dragRef.current!.y),
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  function handleImageLoad() {
    const img = imageRef.current;
    if (img) {
      setAspect(pickDefaultPostCropAspect(img.naturalWidth, img.naturalHeight));
    }
    setReady(true);
  }

  async function handleConfirm() {
    const img = imageRef.current;
    if (!img || !ready) return;
    setLoading(true);
    try {
      const file = await renderCroppedPostImageFile(
        img,
        crop,
        viewport.width,
        viewport.height
      );
      const previewUrl = URL.createObjectURL(file);
      onConfirm(file, previewUrl);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const img = imageRef.current;
  const displayScale =
    img && ready ? getPostCropDisplayScale(img, crop, viewport.width, viewport.height) : 1;
  const renderedW = img && ready ? img.naturalWidth * displayScale : viewport.width;
  const renderedH = img && ready ? img.naturalHeight * displayScale : viewport.height;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div
        className="max-h-[min(92dvh,720px)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-crop-title"
      >
        <h2 id="post-crop-title" className="text-base font-bold text-[var(--toq-navy)]">
          Ajustar imagem do post
        </h2>
        <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
          Arraste para mover e use o zoom. Escolha o formato ou publique a imagem inteira sem
          cortar.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {POST_CROP_ASPECTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAspect(opt)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                aspect.id === opt.id
                  ? "toq-btn-primary text-white"
                  : "toq-btn-outline"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div
          className="post-crop-viewport mx-auto mt-4"
          style={{ width: viewport.width, height: viewport.height }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt=""
            draggable={false}
            onLoad={handleImageLoad}
            className="post-crop-image"
            style={{
              width: renderedW,
              height: renderedH,
              transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px))`,
            }}
          />
        </div>

        <label className="mt-4 block text-xs font-semibold text-[var(--toq-navy)]">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={crop.scale}
            onChange={(e) =>
              setCrop((prev) => ({ ...prev, scale: Number(e.target.value) }))
            }
            className="mt-2 w-full accent-[var(--toq-accent)]"
          />
        </label>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-[var(--toq-border)] px-4 py-2 text-sm font-semibold text-[var(--toq-navy)]"
          >
            Cancelar
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="rounded-xl toq-btn-outline px-4 py-2 text-sm font-semibold"
            >
              Usar inteira
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={loading || !ready}
            className="rounded-xl toq-btn-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Aplicando…" : "Usar recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}
