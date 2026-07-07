"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AVATAR_VIEWPORT_SIZE,
  getDisplayScale,
  renderCroppedAvatarFile,
  type AvatarCropState,
} from "@/lib/avatarCrop";

type Props = {
  open: boolean;
  imageSrc: string;
  onConfirm: (file: File, previewUrl: string) => void;
  onCancel: () => void;
};

export function AvatarCropModal({ open, imageSrc, onConfirm, onCancel }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [crop, setCrop] = useState<AvatarCropState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ scale: 1, offsetX: 0, offsetY: 0 });
    setReady(false);
  }, [open, imageSrc]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: crop.offsetX,
      oy: crop.offsetY,
    };
  }, [crop.offsetX, crop.offsetY]);

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

  async function handleConfirm() {
    const img = imageRef.current;
    if (!img || !ready) return;
    setLoading(true);
    try {
      const file = await renderCroppedAvatarFile(img, crop);
      const previewUrl = URL.createObjectURL(file);
      onConfirm(file, previewUrl);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const img = imageRef.current;
  const displayScale =
    img && ready ? getDisplayScale(img, crop) : 1;
  const renderedW = img && ready ? img.naturalWidth * displayScale : AVATAR_VIEWPORT_SIZE;
  const renderedH = img && ready ? img.naturalHeight * displayScale : AVATAR_VIEWPORT_SIZE;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
      >
        <h2 id="avatar-crop-title" className="text-base font-bold text-[var(--toq-navy)]">
          Ajustar foto de perfil
        </h2>
        <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
          Arraste para centralizar e use o zoom para aproximar ou afastar.
        </p>

        <div
          className="avatar-crop-viewport mx-auto mt-4"
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
            onLoad={() => setReady(true)}
            className="avatar-crop-image"
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

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[var(--toq-navy)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={loading || !ready}
            className="rounded-xl toq-btn-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Usar foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
