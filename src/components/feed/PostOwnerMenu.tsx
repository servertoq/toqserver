"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  onEdit: () => void;
  onDelete: () => void;
};

export function PostOwnerMenu({ onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.right });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePos();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, updatePos]);

  const menu =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        style={{ top: pos.top, left: pos.left }}
        className="fixed z-[120] w-40 -translate-x-full overflow-hidden rounded-xl border border-[var(--toq-border)] bg-white py-1 shadow-[0_12px_40px_rgba(5,16,36,0.16)]"
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onEdit();
          }}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--toq-navy)] transition hover:bg-slate-50"
        >
          <svg className="h-4 w-4 shrink-0 text-[var(--toq-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          Editar
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          Excluir
        </button>
      </div>,
      document.body
    );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--toq-text-muted)] transition hover:bg-slate-100 hover:text-[var(--toq-navy)]"
        aria-label="Opções da publicação"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {menu}
    </>
  );
}
