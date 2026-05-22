"use client";

import { useRef, useState } from "react";
import type { PostType } from "@/types/feed";

type Props = {
  avatarUrl: string | null;
  username: string;
  loading: boolean;
  onSubmit: (data: {
    body: string;
    postType: PostType;
    title: string | null;
    files: File[];
  }) => Promise<void>;
};

export function CreatePostBox({ avatarUrl, username, loading, onSubmit }: Props) {
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState<PostType>("player");
  const [title, setTitle] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files, ...Array.from(list)].slice(0, 4);
    setFiles(next);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(index: number) {
    const next = files.filter((_, i) => i !== index);
    URL.revokeObjectURL(previews[index]);
    setFiles(next);
    setPreviews(previews.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    await onSubmit({
      body: trimmed,
      postType,
      title: postType === "event" ? title.trim() || null : null,
      files,
    });

    setBody("");
    setTitle("");
    setPostType("player");
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews([]);
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-2xl border-2 border-[var(--toq-lime-light)] bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-3">
        <Avatar src={avatarUrl} name={username} size="md" />
        <div>
          <p className="text-sm font-bold text-[var(--toq-navy)]">{username}</p>
          <p className="text-xs text-[var(--toq-text-muted)]">Novo post</p>
        </div>
      </div>

      <div className="mb-2 flex gap-2">
        {(["player", "event"] as PostType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPostType(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              postType === t
                ? "bg-[var(--toq-lime-light)] text-[var(--toq-navy)]"
                : "bg-slate-100 text-[var(--toq-text-muted)] hover:bg-slate-200"
            }`}
          >
            {t === "event" ? "Evento" : "Jogador"}
          </button>
        ))}
      </div>

      {postType === "event" && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título do evento (opcional)"
          className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--toq-lime-light)]"
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="O que você quer compartilhar? Use emojis do teclado 🎾🔥"
        rows={3}
        className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-[var(--toq-text)] outline-none focus:border-[var(--toq-lime-light)] focus:ring-2 focus:ring-[var(--toq-lime-light)]/20"
        required
      />

      {previews.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {previews.map((src, i) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs font-semibold text-[var(--toq-sky)] hover:underline"
          >
            + Adicionar fotos
          </button>
          <span className="ml-2 text-[10px] text-[var(--toq-text-muted)]">até 4 imagens</span>
        </div>
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="rounded-lg bg-[var(--toq-lime-light)] px-4 py-2 text-sm font-bold text-[var(--toq-navy)] transition hover:bg-[var(--toq-lime-bright)] disabled:opacity-50"
        >
          {loading ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}

function Avatar({
  src,
  name,
  size = "sm",
}: {
  src: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${dim} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-[var(--toq-sky)] font-bold text-white`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
