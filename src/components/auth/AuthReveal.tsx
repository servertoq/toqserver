"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Atraso em ms antes de liberar a classe (útil em sequência). */
  delayMs?: number;
};

export function AuthReveal({ children, className = "", delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        timeoutId = setTimeout(() => setVisible(true), delayMs);
        io.disconnect();
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [delayMs]);

  return (
    <div
      ref={ref}
      className={`auth-reveal${visible ? " auth-reveal--in" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
