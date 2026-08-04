"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getPostCropDisplayScale,
  pickDefaultPostCropAspect,
  POST_CROP_ASPECTS,
  POST_CROP_VIEWPORT_MAX_W,
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
  const [mounted, setMounted] = useState(false);
  const [crop, setCrop] = useState<ImageCropState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [aspect, setAspect] = useState<PostCropAspect>(POST_CROP_ASPECTS[0]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportMaxW, setViewportMaxW] = useState(280);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCrop({ scale: 1, offsetX: 0, offsetY: 0 });
    setReady(false);
    setError(null);
  }, [open, imageSrc]);

  useEffect(() => {
    function updateViewportMax() {
      const available = Math.min(window.innerWidth - 40, POST_CROP_VIEWPORT_MAX_W);
      // Em telas baixas, reduz a prévia para caber zoom + botões
      const shortScreen = window.innerHeight < 740;
      setViewportMaxW(Math.max(200, shortScreen ? Math.min(available, 240) : available));
    }
    updateViewportMax();
    window.addEventListener("resize", updateViewportMax);
    return () => window.removeEventListener("resize", updateViewportMax);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onCancel]);

  const viewport = useMemo(
    () => postCropViewportSize(aspect.ratio, viewportMaxW),
    [aspect.ratio, viewportMaxW]
  );

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
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setAspect(pickDefaultPostCropAspect(img.naturalWidth, img.naturalHeight));
      setReady(true);
      setError(null);
      return;
    }
    setReady(false);
    setError("Não foi possível carregar esta imagem.");
  }

  function handleImageError() {
    setReady(false);
    setError("Não foi possível carregar esta imagem. Tente outro arquivo.");
  }

  async function handleConfirm() {
    const img = imageRef.current;
    if (!img || !ready) return;
    setLoading(true);
    setError(null);
    try {
      const file = await renderCroppedPostImageFile(
        img,
        crop,
        viewport.width,
        viewport.height
      );
      const previewUrl = URL.createObjectURL(file);
      onConfirm(file, previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao recortar a imagem.");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !mounted) return null;

  const img = imageRef.current;
  const displayScale =
    img && ready ? getPostCropDisplayScale(img, crop, viewport.width, viewport.height) : 1;
  const renderedW =
    img && ready ? Math.max(1, img.naturalWidth * displayScale) : viewport.width;
  const renderedH =
    img && ready ? Math.max(1, img.naturalHeight * displayScale) : viewport.height;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-crop-title"
        className="flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 [-webkit-overflow-scrolling:touch]">
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
                  aspect.id === opt.id ? "toq-btn-primary text-white" : "toq-btn-outline"
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
              onError={handleImageError}
              className="post-crop-image"
              style={{
                width: renderedW,
                height: renderedH,
                transform: `translate(calc(-50% + ${crop.offsetX}px), calc(-50% + ${crop.offsetY}px))`,
              }}
            />
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}

          <label className="mt-4 mb-2 block text-xs font-semibold text-[var(--toq-navy)]">
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
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--toq-border)] bg-[var(--toq-card)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-[var(--toq-border)] px-4 py-2.5 text-sm font-semibold text-[var(--toq-navy)]"
          >
            Cancelar
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="rounded-xl toq-btn-outline px-4 py-2.5 text-sm font-semibold"
            >
              {error ? "Usar mesmo assim" : "Usar inteira"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={loading || !ready}
            className="rounded-xl toq-btn-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Aplicando…" : "Usar recorte"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
