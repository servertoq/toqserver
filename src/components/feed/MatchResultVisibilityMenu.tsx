"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { updateMatchResultVisibility } from "@/lib/openMatches";

type Mode = "everyone" | "friends" | "club" | "participants";

type Props = {
  postId: string;
  hasClub: boolean;
  onChanged?: () => void;
  onDelete?: () => void;
};

const MODES: { mode: Mode; label: string; needsClub?: boolean }[] = [
  { mode: "everyone", label: "Visível para todos" },
  { mode: "friends", label: "Somente amigos" },
  { mode: "club", label: "Somente membros do clube", needsClub: true },
  { mode: "participants", label: "Somente jogadores da partida" },
];

export function MatchResultVisibilityMenu({
  postId,
  hasClub,
  onChanged,
  onDelete,
}: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

  async function apply(mode: Mode) {
    setSaving(true);
    setMessage(null);
    const { error } = await updateMatchResultVisibility(supabase, postId, mode);
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    setOpen(false);
    onChanged?.();
  }

  const menu =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        style={{ top: pos.top, left: pos.left }}
        className="fixed z-[120] w-56 -translate-x-full overflow-hidden rounded-xl border border-[var(--toq-border)] bg-[var(--toq-card)] py-1 shadow-xl"
        role="menu"
      >
        <p className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
          Quem vê este resultado
        </p>
        {MODES.filter((m) => !m.needsClub || hasClub).map((m) => (
          <button
            key={m.mode}
            type="button"
            role="menuitem"
            disabled={saving}
            onClick={() => void apply(m.mode)}
            className="flex w-full items-center px-3.5 py-2.5 text-left text-sm font-semibold text-[var(--toq-text)] hover:bg-[var(--toq-input-bg)] disabled:opacity-50"
          >
            {m.label}
          </button>
        ))}
        {message && (
          <p className="px-3.5 py-2 text-xs text-red-400">{message}</p>
        )}
        {onDelete && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center border-t border-[var(--toq-border)] px-3.5 py-2.5 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10"
          >
            Excluir
          </button>
        )}
      </div>,
      document.body
    );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Opções do resultado"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-1.5 text-[var(--toq-text-muted)] hover:bg-[var(--toq-input-bg)]"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {menu}
    </>
  );
}
