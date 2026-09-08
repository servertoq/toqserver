"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  urls: string[];
  name: string;
  onEdit?: () => void;
};

export function ProfilePhotoCarousel({ urls, name, onEdit }: Props) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const urlsKey = urls.join("|");

  useEffect(() => {
    setIndex(0);
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
          <button type="button" className="profile-photo-edit" onClick={onEdit}>
            Editar fotos
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="profile-photo-carousel"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
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
                if (offset !== 0) go(i);
              }}
              aria-label={offset === 0 ? `Foto ${i + 1} de ${count}` : `Ver foto ${i + 1}`}
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
            ‹
          </button>
          <button
            type="button"
            className="profile-photo-nav profile-photo-nav--next"
            aria-label="Próxima foto"
            onClick={() => go(safeIndex + 1)}
          >
            ›
          </button>
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
        </>
      )}
      {onEdit && (
        <button type="button" className="profile-photo-edit" onClick={onEdit}>
          Editar fotos
        </button>
      )}
    </div>
  );
}
