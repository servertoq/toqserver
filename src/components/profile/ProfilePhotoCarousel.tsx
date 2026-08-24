"use client";

import { useEffect, useState } from "react";

type Props = {
  slides: string[];
  alt?: string;
  className?: string;
  imgClassName?: string;
};

export function ProfilePhotoCarousel({
  slides,
  alt = "",
  className = "",
  imgClassName = "h-full w-full object-cover",
}: Props) {
  const [index, setIndex] = useState(0);
  const list = slides.filter(Boolean);
  const key = list.join("|");

  useEffect(() => {
    setIndex(0);
  }, [key]);

  if (list.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 ${className}`}
        aria-hidden
      >
        <svg className="h-16 w-16 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
        </svg>
      </div>
    );
  }

  const current = list[Math.min(index, list.length - 1)]!;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={current} src={current} alt={alt} className={imgClassName} />

      {list.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg font-bold text-white transition hover:bg-black/65"
            onClick={() => setIndex((i) => (i - 1 + list.length) % list.length)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            className="absolute right-2 top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg font-bold text-white transition hover:bg-black/65"
            onClick={() => setIndex((i) => (i + 1) % list.length)}
          >
            ›
          </button>
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-[2] flex justify-center gap-1.5">
            {list.map((url, i) => (
              <span
                key={url + i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === index ? "bg-white" : "bg-white/45"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
