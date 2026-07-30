"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { parseBodySegments } from "@/lib/mentions";
import { profilePath } from "@/lib/publicProfile";

type Props = {
  body: string;
  /** Limite de linhas quando recolhido (padrão 5). */
  maxLines?: number;
  /** Se false, mostra o texto inteiro sem “Ver mais”. */
  collapsible?: boolean;
  className?: string;
};

const LINE_HEIGHT_EM = 1.625;

export function PostBody({
  body,
  maxLines = 5,
  collapsible = true,
  className = "break-words text-sm leading-relaxed text-[var(--toq-text)]",
}: Props) {
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);

  useLayoutEffect(() => {
    setExpanded(false);
    setNeedsToggle(false);
  }, [body]);

  useLayoutEffect(() => {
    if (!collapsible) return;
    const el = contentRef.current;
    if (!el) return;

    const measure = () => {
      if (expanded) return;
      // max-height em vez de -webkit-line-clamp: funciona melhor com quebras de linha (pre-wrap)
      setNeedsToggle(el.scrollHeight > el.clientHeight + 2);
    };

    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [body, collapsible, expanded, maxLines]);

  const segments = parseBodySegments(body);
  const collapsed = collapsible && !expanded;

  return (
    <div>
      <p
        ref={contentRef}
        className={`${className} whitespace-pre-wrap`}
        style={
          collapsed
            ? {
                maxHeight: `calc(${LINE_HEIGHT_EM * maxLines}em)`,
                overflow: "hidden",
              }
            : undefined
        }
      >
        {segments.map((seg, i) =>
          seg.type === "mention" ? (
            <Link
              key={`${i}-${seg.username}`}
              href={profilePath(seg.username)}
              className="font-semibold text-[var(--toq-sky)] hover:underline"
            >
              @{seg.username}
            </Link>
          ) : (
            <span key={i}>{seg.value}</span>
          )
        )}
      </p>
      {collapsible && needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-bold text-[var(--toq-sky)] hover:underline"
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </div>
  );
}
