"use client";

import { useEffect } from "react";
import { CreatePostBox } from "@/components/feed/CreatePostBox";
import type { PostType, PostVisibility } from "@/types/feed";

type SubmitData = {
  body: string;
  postType: PostType;
  title: string | null;
  visibility: PostVisibility;
  eventDate: string | null;
  eventTime: string | null;
  files: File[];
};

type Props = {
  open: boolean;
  avatarUrl: string | null;
  username: string;
  displayName?: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: SubmitData) => Promise<void>;
};

export function CreatePostModal({
  open,
  avatarUrl,
  username,
  displayName,
  loading,
  onClose,
  onSubmit,
}: Props) {
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="create-post-modal-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-start sm:overflow-y-auto sm:p-4 sm:pt-[max(1rem,8vh)]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-post-modal-title"
        className="create-post-modal-panel relative w-full max-w-lg sm:my-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[var(--toq-text-muted)] transition hover:bg-black/10 hover:text-[var(--toq-navy)] disabled:opacity-50"
          aria-label="Fechar"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2 id="create-post-modal-title" className="sr-only">
          Novo post
        </h2>

        <CreatePostBox
          avatarUrl={avatarUrl}
          username={username}
          displayName={displayName}
          loading={loading}
          context="global"
          inModal
          className="mb-0 rounded-t-2xl shadow-[0_16px_48px_rgba(5,16,36,0.14)] sm:rounded-2xl"
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
