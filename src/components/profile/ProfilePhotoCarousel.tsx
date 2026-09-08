"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronIcon } from "@/components/shared/HScroll";

type Props = {
  urls: string[];
  name: string;
  onEdit?: () => void;
};

export function ProfilePhotoCarousel({ urls, name, onEdit }: Props) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const urlsKey = urls.join("|");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIndex(0);
    setLightbox(false);
  }, [urlsKey]);

  const count = urls.length;
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);

  function go(next: number) {
    if (count <= 1) return;
    setIndex((next + count) % count);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    const end = e.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start == null || end == null) return;
    const delta = start - end;
    if (Math.abs(delta) < 40) return;
    go(safeIndex + (delta > 0 ? 1 : -1));
  }

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") go(safeIndex - 1);
      if (e.key === "ArrowRight") go(safeIndex + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, safeIndex, count]);

  if (count === 0) {
    const initial = name.charAt(0).toUpperCase() || "?";
    return (
      <div className="profile-photo-carousel">
        <div className="profile-photo-track">
          <div className="profile-photo-slide is-active">
            <div className="profile-photo-fallback">{initial}</div>
          </div>
        </div>
        {onEdit && (
          <div className="profile-photo-footer">
            <button type="button" className="profile-photo-edit" onClick={onEdit}>
              Editar fotos
            </button>
          </div>
        )}
      </div>
    );
  }

  const activeUrl = urls[safeIndex];

  return (
    <div
      className="profile-photo-carousel"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="profile-photo-stage">
        <div className="profile-photo-track">
          {urls.map((url, i) => {
            const offset = i - safeIndex;
            const state =
              offset === 0 ? "is-active" : offset === -1 ? "is-prev" : offset === 1 ? "is-next" : "is-hidden";
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                className={`profile-photo-slide ${state}`}
                onClick={() => {
                  if (offset !== 0) {
                    go(i);
                    return;
                  }
                  setLightbox(true);
                }}
                aria-label={
                  offset === 0 ? `Ver foto ${i + 1} em tamanho real` : `Ver foto ${i + 1}`
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" draggable={false} />
              </button>
            );
          })}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="profile-photo-nav profile-photo-nav--prev"
              aria-label="Foto anterior"
              onClick={() => go(safeIndex - 1)}
            >
              <ChevronIcon dir="left" size={18} />
            </button>
            <button
              type="button"
              className="profile-photo-nav profile-photo-nav--next"
              aria-label="Próxima foto"
              onClick={() => go(safeIndex + 1)}
            >
              <ChevronIcon dir="right" size={18} />
            </button>
          </>
        )}
      </div>

      <div className="profile-photo-footer">
        {count > 1 && (
          <div className="profile-photo-dots" role="tablist" aria-label="Fotos do perfil">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === safeIndex}
                aria-label={`Foto ${i + 1}`}
                className={`profile-photo-dot ${i === safeIndex ? "is-active" : ""}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
        {onEdit && (
          <button type="button" className="profile-photo-edit" onClick={onEdit}>
            Editar fotos
          </button>
        )}
      </div>

      {mounted &&
        lightbox &&
        createPortal(
          <div
            className="profile-photo-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Foto em tamanho real"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setLightbox(false);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeUrl} alt="" className="profile-photo-lightbox-img" />
            {count > 1 && (
              <>
                <button
                  type="button"
                  className="profile-photo-lightbox-nav profile-photo-lightbox-nav--prev"
                  aria-label="Foto anterior"
                  onClick={() => go(safeIndex - 1)}
                >
                  <ChevronIcon dir="left" size={20} />
                </button>
                <button
                  type="button"
                  className="profile-photo-lightbox-nav profile-photo-lightbox-nav--next"
                  aria-label="Próxima foto"
                  onClick={() => go(safeIndex + 1)}
                >
                  <ChevronIcon dir="right" size={20} />
                </button>
              </>
            )}
            <p className="profile-photo-lightbox-count">
              {safeIndex + 1}/{count}
            </p>
            <button
              type="button"
              className="profile-photo-lightbox-close"
              onClick={() => setLightbox(false)}
            >
              Fechar
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
