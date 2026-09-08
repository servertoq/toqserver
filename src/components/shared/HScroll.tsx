"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  innerRole?: string;
  ariaLabel?: string;
};

export function HScroll({
  children,
  className = "",
  innerClassName = "",
  innerRole,
  ariaLabel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 6);
    setCanRight(max > 8 && el.scrollLeft < max - 6);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true });
    const frame = window.requestAnimationFrame(update);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function scrollByPage(dir: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.65, 140), behavior: "smooth" });
  }

  return (
    <div className={`hscroll ${className}`.trim()}>
      {canLeft && (
        <button
          type="button"
          className="hscroll-btn hscroll-btn--prev"
          aria-label="Ver opções anteriores"
          onClick={() => scrollByPage(-1)}
        >
          ‹
        </button>
      )}
      <div
        ref={ref}
        role={innerRole}
        aria-label={ariaLabel}
        className={`hscroll-track ${innerClassName}`.trim()}
      >
        {children}
      </div>
      {canRight && (
        <button
          type="button"
          className="hscroll-btn hscroll-btn--next"
          aria-label="Ver mais opções"
          onClick={() => scrollByPage(1)}
        >
          ›
        </button>
      )}
    </div>
  );
}
