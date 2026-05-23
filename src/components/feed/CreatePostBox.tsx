"use client";

import { useRef, useState } from "react";
import { MentionTextarea } from "@/components/feed/MentionTextarea";
import {
  MAX_POST_MEDIA,
  mergePostMediaFiles,
  POST_IMAGE_ACCEPT,
  POST_VIDEO_ACCEPT,
  mediaKindFromFile,
} from "@/lib/postMedia";
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
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<{ url: string; kind: "image" | "video" }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const visOptions = visibilityOptions(context);

  function revokePreviews(items: { url: string }[]) {
    items.forEach((p) => URL.revokeObjectURL(p.url));
  }

  function applyMedia(next: File[]) {
    revokePreviews(previews);
    setFiles(next);
    setPreviews(
      next.map((f) => ({
        url: URL.createObjectURL(f),
        kind: mediaKindFromFile(f),
      }))
    );
  }

  function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    const { files: next, error } = mergePostMediaFiles(files, Array.from(list));
    if (error) {
      setMediaError(error);
      return;
    }
    setMediaError(null);
    if (next) applyMedia(next);
  }

  function removeMedia(index: number) {
    URL.revokeObjectURL(previews[index].url);
    const nextFiles = files.filter((_, i) => i !== index);
    const nextPreviews = previews.filter((_, i) => i !== index);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
    setMediaError(null);
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
    revokePreviews(previews);
    setPreviews([]);
    setFiles([]);
    setMediaError(null);
    if (imageRef.current) imageRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";
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
          {previews.map((item, i) => (
            <div
              key={item.url}
              className={`relative overflow-hidden rounded-lg ${
                item.kind === "video" ? "aspect-video sm:col-span-2" : "aspect-square"
              }`}
            >
              {item.kind === "video" ? (
                <video src={item.url} controls playsInline className="h-full w-full bg-black object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {mediaError && (
        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
          {mediaError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <input
            ref={imageRef}
            type="file"
            accept={POST_IMAGE_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={videoRef}
            type="file"
            accept={POST_VIDEO_ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => imageRef.current?.click()}
            className="text-xs font-semibold text-[var(--toq-sky)] hover:underline"
          >
            + Fotos
          </button>
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            className="text-xs font-semibold text-[var(--toq-sky)] hover:underline"
          >
            + Vídeo
          </button>
          <span className="text-[10px] text-[var(--toq-text-muted)]">
            até {MAX_POST_MEDIA} arquivos · 1 vídeo (50 MB)
          </span>
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
