"use client";

import { useRef, useState } from "react";
import { MentionTextarea } from "@/components/feed/MentionTextarea";
import { visibilityOptions, type PostContext } from "@/lib/postVisibility";
import type { PostType, PostVisibility } from "@/types/feed";

type Props = {
  avatarUrl: string | null;
  username: string;
  loading: boolean;
  context?: PostContext;
  onSubmit: (data: {
    body: string;
    postType: PostType;
    title: string | null;
    visibility: PostVisibility;
    eventDate: string | null;
    eventTime: string | null;
    files: File[];
  }) => Promise<void>;
};

export function CreatePostBox({
  avatarUrl,
  username,
  loading,
  context = "global",
  onSubmit,
}: Props) {
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState<PostType>("player");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>(
    context === "community" ? "private" : "public"
  );
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const visOptions = visibilityOptions(context);

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
      visibility,
      eventDate: postType === "event" && eventDate ? eventDate : null,
      eventTime: postType === "event" && eventTime ? eventTime : null,
      files,
    });

    setBody("");
    setTitle("");
    setEventDate("");
    setEventTime("");
    setPostType("player");
    setVisibility(context === "community" ? "private" : "public");
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
      <div className="mb-3 flex items-start gap-3">
        <Avatar src={avatarUrl} name={username} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-[var(--toq-navy)]">{username}</p>
              <p className="text-xs text-[var(--toq-text-muted)]">Novo post</p>
            </div>
            <VisibilityToggle
              className="hidden sm:flex"
              options={visOptions}
              value={visibility}
              onChange={setVisibility}
            />
          </div>
          <div className="mt-2 flex gap-2">
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
                {t === "event" ? "Evento" : "Post"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {postType === "event" && (
        <div className="mb-2 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do evento (opcional)"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)] outline-none focus:border-[var(--toq-lime-light)]"
          />
          <div className="flex flex-wrap gap-2">
            <label className="min-w-[140px] flex-1">
              <span className="mb-1 block text-[10px] font-semibold text-[var(--toq-text-muted)]">
                Data (opcional)
              </span>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)]"
              />
            </label>
            <label className="min-w-[120px] flex-1">
              <span className="mb-1 block text-[10px] font-semibold text-[var(--toq-text-muted)]">
                Horário (opcional)
              </span>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)]"
              />
            </label>
          </div>
        </div>
      )}

      <MentionTextarea
        value={body}
        onChange={setBody}
        placeholder="O que você quer compartilhar? Use @usuario para mencionar 🎾"
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
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <VisibilityToggle
            className="sm:hidden"
            options={visOptions}
            value={visibility}
            onChange={setVisibility}
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="rounded-lg bg-[var(--toq-lime-light)] px-4 py-2 text-sm font-bold text-[var(--toq-navy)] transition hover:bg-[var(--toq-lime-bright)] disabled:opacity-50"
          >
            {loading ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </form>
  );
}

function VisibilityToggle({
  className = "",
  options,
  value,
  onChange,
}: {
  className?: string;
  options: { value: PostVisibility; label: string; hint: string }[];
  value: PostVisibility;
  onChange: (v: PostVisibility) => void;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="group"
      aria-label="Visibilidade do post"
    >
      <span className="text-[10px] font-medium text-[var(--toq-text-muted)]">Visibilidade</span>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              value === opt.value
                ? "bg-white text-[var(--toq-navy)] shadow-sm"
                : "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
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
