"use client";

import { useEffect, useState } from "react";
import type { ClubProductImage } from "@/types/clubFeatures";

type Props = {
  images: ClubProductImage[];
  alt?: string;
  /** `card` = grade da loja; `detail` = modal do produto */
  variant?: "card" | "detail";
  intervalMs?: number;
  className?: string;
};

export function ClubProductImageCarousel({
  images,
  alt = "",
  variant = "card",
  intervalMs = 3200,
  className = "",
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const list = images.length > 0 ? images : [];

  useEffect(() => {
    setIndex(0);
  }, [list.map((i) => i.id).join("|")]);

  useEffect(() => {
    if (list.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % list.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [list.length, paused, intervalMs]);

  if (list.length === 0) {
    return (
      <div
        className={`club-product-media flex items-center justify-center text-2xl text-[var(--toq-text-muted)] ${
          variant === "detail" ? "club-product-media--detail" : ""
        } ${className}`}
      >
        🛍️
      </div>
    );
  }

  const current = list[Math.min(index, list.length - 1)];

  return (
    <div
      className={`club-product-media ${variant === "detail" ? "club-product-media--detail" : ""} ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current.id}
        src={current.url}
        alt={alt}
        className="club-product-carousel-img"
      />
      {list.length > 1 && (
        <>
          <div className="club-product-carousel-dots" role="tablist" aria-label="Fotos do produto">
            {list.map((img, i) => (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Foto ${i + 1}`}
                className={`club-product-carousel-dot ${i === index ? "is-active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="club-product-carousel-nav club-product-carousel-nav--prev"
            aria-label="Foto anterior"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((currentIdx) => (currentIdx - 1 + list.length) % list.length);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="club-product-carousel-nav club-product-carousel-nav--next"
            aria-label="Próxima foto"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((currentIdx) => (currentIdx + 1) % list.length);
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
