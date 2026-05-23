"use client";

import { useCallback, useEffect, useState } from "react";

type AdSlide = {
  id: string;
  tag: string;
  title: string;
  description: string;
  cta: string;
  gradient: string;
  accent: string;
};

const ADS: AdSlide[] = [
  {
    id: "aulas",
    tag: "Parceiro",
    title: "Aulas de tênis",
    description: "Primeira aula experimental grátis na sua região.",
    cta: "Agendar agora",
    gradient: "from-[#0a1a5c] via-[#1e3a8a] to-[#437df4]",
    accent: "bg-[var(--toq-lime-light)] text-[var(--toq-navy)]",
  },
  {
    id: "wilson",
    tag: "Equipamentos",
    title: "Raquetes Wilson",
    description: "Até 30% off em modelos selecionados para iniciantes.",
    cta: "Ver ofertas",
    gradient: "from-[#14532d] via-[#166534] to-[#22c55e]",
    accent: "bg-white text-[#14532d]",
  },
  {
    id: "toq-open",
    tag: "Evento",
    title: "TOQ Open 2026",
    description: "Inscrições abertas para o torneio amador da comunidade.",
    cta: "Inscrever-se",
    gradient: "from-[#312e81] via-[#4338ca] to-[#6366f1]",
    accent: "bg-[var(--toq-lime-light)] text-[var(--toq-navy)]",
  },
  {
    id: "quadra",
    tag: "Reservas",
    title: "Quadra coberta",
    description: "Jogue à noite com conforto. Horários disponíveis hoje.",
    cta: "Reservar quadra",
    gradient: "from-[#7c2d12] via-[#c2410c] to-[#fb923c]",
    accent: "bg-white text-[#7c2d12]",
  },
];

const ROTATE_MS = 6000;

export function FeedAdCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((next: number) => {
    setIndex((next + ADS.length) % ADS.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % ADS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const ad = ADS[index];

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        role="region"
        aria-label="Propagandas"
        aria-live="polite"
      >
        <div
          className={`absolute inset-0 bg-gradient-to-br ${ad.gradient} p-5 transition-opacity duration-500`}
        >
          <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {ad.tag}
          </span>
          <p className="mt-4 text-xl font-extrabold leading-tight text-white">{ad.title}</p>
          <p className="mt-2 text-sm leading-snug text-white/90">{ad.description}</p>
          <span
            className={`mt-5 inline-block rounded-lg px-3 py-1.5 text-xs font-bold ${ad.accent}`}
          >
            {ad.cta}
          </span>
          <span className="absolute bottom-4 right-4 text-5xl opacity-20" aria-hidden>
            🎾
          </span>
        </div>

        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {ADS.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Propaganda ${i + 1}: ${slide.title}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => goTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--toq-text-muted)]">
        Publicidade
      </p>
    </div>
  );
}
