"use client";

import { useState } from "react";
import { ReportDialog } from "./ReportDialog";
import type { ReportTarget } from "@/types/support";

type Props = {
  target: ReportTarget;
  userId: string;
  className?: string;
  compact?: boolean;
};

export function ReportButton({ target, userId, className = "", compact = false }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          `inline-flex items-center gap-1 text-xs font-semibold text-[var(--toq-text-muted)] transition hover:text-red-600 ${
            compact ? "" : ""
          }`
        }
        aria-label={`Denunciar ${target.label}`}
      >
        <svg
          className="h-3.5 w-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
          />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        Denunciar
      </button>
      <ReportDialog
        open={open}
        target={target}
        userId={userId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
