"use client";

import { useRef, useState } from "react";
import { MentionTextarea } from "@/components/feed/MentionTextarea";
import { PostImageCropModal } from "@/components/feed/PostImageCropModal";
import {
  MAX_POST_MEDIA,
  mergePostMediaFiles,
  POST_IMAGE_ACCEPT,
  POST_VIDEO_ACCEPT,
  mediaKindFromFile,
} from "@/lib/postMedia";
import { visibilityOptions, type PostContext } from "@/lib/postVisibility";
import { profileDisplayName } from "@/lib/profile";
import type { CreatePostSubmitData, EditPostSubmitData } from "@/lib/createPost";
import type { FeedPost, PostType, PostVisibility } from "@/types/feed";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type MediaPreview = { url: string; kind: "image" | "video" };

type CropSession = {
  /** Índice no array de arquivos já mesclados, ou null se ainda na fila */
  replaceIndex: number | null;
  sourceUrl: string;
  sourceFile: File;
};
type Props = {
  avatarUrl: string | null;
  username: string;
  displayName?: string | null;
  loading: boolean;
  context?: PostContext;
  className?: string;
  mode?: "create" | "edit";
  initialPost?: FeedPost;
  inModal?: boolean;
  /** Só no feed do clube: habilita a aba Partida (sempre privada). */
  allowMatch?: boolean;
  onSubmit: (data: CreatePostSubmitData | EditPostSubmitData) => Promise<void>;
};

function eventTimeInputValue(eventTime: string | null) {
  if (!eventTime) return "";
  return eventTime.slice(0, 5);
}

export function CreatePostBox({
  avatarUrl,
  username,
  displayName = null,
  loading,
  context = "global",
  className = "mb-6",
  mode = "create",
  initialPost,
  inModal = false,
  allowMatch = false,
  onSubmit,
}: Props) {
  const isEdit = mode === "edit" && !!initialPost;
  const [body, setBody] = useState(initialPost?.body ?? "");
  const [postType, setPostType] = useState<PostType>(initialPost?.post_type ?? "player");
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [visibility, setVisibility] = useState<PostVisibility>(
    initialPost?.visibility ?? (context === "community" ? "private" : "public")
  );
  const [eventDate, setEventDate] = useState(initialPost?.event_date ?? "");
  const [eventTime, setEventTime] = useState(eventTimeInputValue(initialPost?.event_time ?? null));
  const [matchCapacity, setMatchCapacity] = useState(
    initialPost?.match_capacity != null ? String(initialPost.match_capacity) : "4"
  );
  const [matchError, setMatchError] = useState<string | null>(null);
  const [pollOptions, setPollOptions] = useState(
    initialPost?.poll?.options.map((o) => o.label) ?? ["", ""]
  );
  const [pollAllowMultiple, setPollAllowMultiple] = useState(
    initialPost?.poll?.allow_multiple ?? false
  );
  const [pollShowResultsToAll, setPollShowResultsToAll] = useState(
    initialPost?.poll?.show_results_to_all ?? true
  );
  const [pollError, setPollError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<MediaPreview[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [existingMedia, setExistingMedia] = useState(
    () =>
      (initialPost?.images ?? []).map((item) => ({
        url: item.url,
        kind: item.media_type ?? "image",
      }))
  );
  const [removedImageUrls, setRemovedImageUrls] = useState<string[]>([]);
  const [cropQueue, setCropQueue] = useState<CropSession[]>([]);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const { isSubmitting, guard } = useSingleSubmit();

  const visOptions = visibilityOptions(context);
  const shownName = profileDisplayName({ display_name: displayName, username });
  const activeCrop = cropQueue[0] ?? null;

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
    const incoming = Array.from(list);
    const { files: merged, error } = mergePostMediaFiles(files, incoming);
    if (error) {
      setMediaError(error);
      return;
    }
    setMediaError(null);
    if (!merged) return;

    const newOnes = merged.slice(files.length);
    const newImages = newOnes.filter((f) => mediaKindFromFile(f) === "image");
    const newVideos = newOnes.filter((f) => mediaKindFromFile(f) === "video");

    if (newVideos.length > 0) {
      applyMedia([...files, ...newVideos]);
    }

    if (newImages.length > 0) {
      setCropQueue((q) => [
        ...q,
        ...newImages.map((file) => ({
          replaceIndex: null as number | null,
          sourceUrl: URL.createObjectURL(file),
          sourceFile: file,
        })),
      ]);
    }
  }

  function finishCropSession(result: File | null) {
    const current = cropQueue[0];
    if (!current) return;

    URL.revokeObjectURL(current.sourceUrl);

    if (result) {
      setFiles((prev) => {
        const next =
          current.replaceIndex != null
            ? prev.map((f, i) => (i === current.replaceIndex ? result! : f))
            : [...prev, result];
        setPreviews((old) => {
          old.forEach((p) => URL.revokeObjectURL(p.url));
          return next.map((f) => ({
            url: URL.createObjectURL(f),
            kind: mediaKindFromFile(f),
          }));
        });
        return next;
      });
    }

    setCropQueue((q) => q.slice(1));
    if (imageRef.current) imageRef.current.value = "";
  }

  function openAdjustPreview(index: number) {
    const file = files[index];
    if (!file || mediaKindFromFile(file) !== "image") return;
    setCropQueue((q) => [
      {
        replaceIndex: index,
        sourceUrl: URL.createObjectURL(file),
        sourceFile: file,
      },
      ...q,
    ]);
  }

  function removeMedia(index: number) {
    URL.revokeObjectURL(previews[index].url);
    const nextFiles = files.filter((_, i) => i !== index);
    const nextPreviews = previews.filter((_, i) => i !== index);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
    setMediaError(null);
  }

  function removeExistingMedia(url: string) {
    setExistingMedia((items) => items.filter((item) => item.url !== url));
    setRemovedImageUrls((urls) => (urls.includes(url) ? urls : [...urls, url]));
    setMediaError(null);
  }

  const hasMedia =
    postType !== "poll" && (files.length > 0 || (isEdit && existingMedia.length > 0));
  const matchCapacityNum = Math.round(Number(matchCapacity));
  const matchReady =
    postType === "partida" &&
    !!eventDate &&
    !!eventTime &&
    Number.isFinite(matchCapacityNum) &&
    matchCapacityNum >= 1 &&
    matchCapacityNum <= 64;
  const canPublish =
    !loading &&
    !isSubmitting &&
    (postType === "poll"
      ? body.trim().length > 0
      : postType === "partida"
        ? matchReady
        : body.trim().length > 0 || hasMedia);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!canPublish) return;

    if (postType === "poll") {
      if (!trimmed) return;
      if (!isEdit) {
        const options = pollOptions.map((opt) => opt.trim()).filter(Boolean);
        if (options.length < 2) {
          setPollError("Informe pelo menos 2 opções.");
          return;
        }
        if (options.length > 6) {
          setPollError("Máximo de 6 opções.");
          return;
        }
      }
      setPollError(null);
    } else if (postType === "partida") {
      if (!eventDate || !eventTime) {
        setMatchError("Informe data e horário da partida.");
        return;
      }
      if (!Number.isFinite(matchCapacityNum) || matchCapacityNum < 1 || matchCapacityNum > 64) {
        setMatchError("Quantidade de pessoas deve ser entre 1 e 64.");
        return;
      }
      setMatchError(null);
    } else if (!trimmed && !hasMedia) {
      return;
    }

    const submitPayload = {
      body: trimmed,
      postType,
      title: postType === "event" ? title.trim() || null : null,
      visibility: postType === "partida" ? ("private" as const) : visibility,
      eventDate:
        (postType === "event" || postType === "partida") && eventDate ? eventDate : null,
      eventTime:
        (postType === "event" || postType === "partida") && eventTime ? eventTime : null,
      files: postType === "poll" ? [] : files,
      pollOptions:
        postType === "poll" && !isEdit
          ? pollOptions.map((opt) => opt.trim()).filter(Boolean)
          : undefined,
      pollAllowMultiple: postType === "poll" ? pollAllowMultiple : undefined,
      pollShowResultsToAll: postType === "poll" ? pollShowResultsToAll : undefined,
      matchCapacity: postType === "partida" ? matchCapacityNum : null,
      ...(isEdit ? { removedImageUrls } : {}),
    };

    await guard(async () => {
      await onSubmit(submitPayload);

      if (isEdit) return;

      setBody("");
      setTitle("");
      setEventDate("");
      setEventTime("");
      setMatchCapacity("4");
      setMatchError(null);
      setPollOptions(["", ""]);
      setPollAllowMultiple(false);
      setPollShowResultsToAll(true);
      setPollError(null);
      setPostType("player");
      setVisibility(context === "community" ? "private" : "public");
      revokePreviews(previews);
      setPreviews([]);
      setFiles([]);
      setMediaError(null);
      if (imageRef.current) imageRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    });
  }

  const formBody = (
    <>
      <div className="mb-3 flex items-start gap-3">
        <Avatar src={avatarUrl} name={shownName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-[var(--toq-navy)]">{shownName}</p>
              <p className="text-xs text-[var(--toq-text-muted)]">
                {isEdit
                  ? "Editar publicação"
                  : postType === "poll"
                    ? "Nova enquete"
                    : postType === "partida"
                      ? "Nova partida"
                      : "Novo post"}
              </p>
            </div>
          </div>
          {!isEdit && (
          <div className="mt-2 flex flex-nowrap gap-1.5">
            {([
              "player",
              "event",
              "poll",
              ...(allowMatch ? (["partida"] as const) : []),
            ] as PostType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setPostType(t);
                  setPollError(null);
                  setMatchError(null);
                  if (t === "partida") setVisibility("private");
                }}
                className={`min-w-0 flex-1 rounded-full px-2 py-1 text-center text-xs font-semibold transition ${
                  postType === t
                    ? "toq-btn-primary text-white"
                    : "bg-[var(--toq-surface)] text-[var(--toq-text-muted)] hover:bg-[var(--toq-input-bg)]"
                }`}
              >
                {t === "event"
                  ? "Evento"
                  : t === "poll"
                    ? "Enquete"
                    : t === "partida"
                      ? "Partida"
                      : "Post"}
              </button>
            ))}
          </div>
          )}
        </div>
      </div>

      {(postType === "event" || postType === "partida") && (
        <div className="mb-2 space-y-2">
          {postType === "event" && (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do evento (opcional)"
              className="w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)] outline-none focus:border-[var(--toq-accent)]"
            />
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold text-[var(--toq-text-muted)]">
                Data{postType === "partida" ? "" : " (opcional)"}
              </span>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => {
                  setEventDate(e.target.value);
                  setMatchError(null);
                }}
                required={postType === "partida"}
                className="create-post-datetime-input w-full min-w-0 rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold text-[var(--toq-text-muted)]">
                Horário{postType === "partida" ? "" : " (opcional)"}
              </span>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => {
                  setEventTime(e.target.value);
                  setMatchError(null);
                }}
                required={postType === "partida"}
                className="create-post-datetime-input w-full min-w-0 rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
              />
            </label>
          </div>
          {postType === "partida" && (
            <label className="block max-w-xs">
              <span className="mb-1 block text-[10px] font-semibold text-[var(--toq-text-muted)]">
                Quantidade de pessoas
              </span>
              <input
                type="number"
                min={1}
                max={64}
                value={matchCapacity}
                onChange={(e) => {
                  setMatchCapacity(e.target.value);
                  setMatchError(null);
                }}
                className="w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
              />
            </label>
          )}
          {matchError && (
            <p className="text-xs font-medium text-red-500" role="alert">
              {matchError}
            </p>
          )}
        </div>
      )}

      <MentionTextarea
        value={body}
        onChange={setBody}
        placeholder={
          postType === "poll"
            ? "Qual é a sua pergunta?"
            : postType === "partida"
              ? "Detalhes da partida (opcional)…"
              : "O que você quer compartilhar? 🎾"
        }
        required={false}
      />

      {postType === "poll" && (
        <div className="mt-3 space-y-3">
          {isEdit ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
                Opções
              </p>
              <ul className="space-y-1.5">
                {pollOptions.map((option, index) => (
                  <li
                    key={index}
                    className="rounded-lg border border-[var(--toq-border)] bg-[var(--toq-surface)] px-3 py-2 text-sm text-[var(--toq-navy)]"
                  >
                    {option}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-[var(--toq-text-muted)]">
                As opções da enquete não podem ser alteradas após publicar.
              </p>
            </>
          ) : (
            <>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
            Opções
          </p>
          {pollOptions.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) => {
                  const next = [...pollOptions];
                  next[index] = e.target.value;
                  setPollOptions(next);
                  setPollError(null);
                }}
                placeholder={`Opção ${index + 1}`}
                maxLength={120}
                className="min-w-0 flex-1 rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
              />
              {pollOptions.length > 2 && (
                <button
                  type="button"
                  onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                  className="rounded-lg px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  aria-label={`Remover opção ${index + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 6 && (
            <button
              type="button"
              onClick={() => setPollOptions([...pollOptions, ""])}
              className="text-xs font-semibold text-[var(--toq-sky)] hover:underline"
            >
              + Adicionar opção
            </button>
          )}
            </>
          )}

          <div className="space-y-2 rounded-xl border border-[var(--toq-border)] bg-[var(--toq-surface)] p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={pollAllowMultiple}
                onChange={(e) => setPollAllowMultiple(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-[var(--toq-navy)]">
                Permitir selecionar mais de uma resposta
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={pollShowResultsToAll}
                onChange={(e) => setPollShowResultsToAll(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-[var(--toq-navy)]">
                Mostrar resultados para todos (desmarque para só você ver os votos)
              </span>
            </label>
          </div>

          {pollError && (
            <p className="text-xs font-medium text-red-600" role="alert">
              {pollError}
            </p>
          )}
        </div>
      )}

      {postType !== "poll" && (existingMedia.length > 0 || previews.length > 0) && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {existingMedia.map((item) => (
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
                <img src={item.url} alt="" className="h-full w-full bg-slate-950 object-contain" />
              )}
              <button
                type="button"
                onClick={() => removeExistingMedia(item.url)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
          {previews.map((item, i) => (
            <div
              key={item.url}
              className={`relative overflow-hidden rounded-lg ${
                item.kind === "video" ? "aspect-video sm:col-span-2" : "aspect-square"
              }`}
            >
              {item.kind === "video" ? (
                <video src={item.url} controls playsInline className="h-full w-full bg-black object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="h-full w-full bg-slate-950 object-contain" />
              )}
              {item.kind === "image" && (
                <button
                  type="button"
                  onClick={() => openAdjustPreview(i)}
                  className="absolute bottom-1 left-1 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white"
                >
                  Ajustar
                </button>
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

      {postType !== "poll" && mediaError && (
        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
          {mediaError}
        </p>
      )}
    </>
  );

  const formActions = (
    <div
      className={
        inModal
          ? "flex flex-col gap-3"
          : "mt-3 flex flex-wrap items-center justify-between gap-2"
      }
    >
      {!inModal && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {postType !== "poll" && (
            <>
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
            </>
          )}
        </div>
      )}
      {inModal && postType !== "poll" && (
        <div className="flex flex-wrap items-center gap-3">
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
            className="shrink-0 rounded-lg border border-[var(--toq-border)] px-3 py-2 text-xs font-semibold text-[var(--toq-sky)] transition hover:bg-[var(--toq-surface)]"
          >
            + Fotos
          </button>
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            className="shrink-0 rounded-lg border border-[var(--toq-border)] px-3 py-2 text-xs font-semibold text-[var(--toq-sky)] transition hover:bg-[var(--toq-surface)]"
          >
            + Vídeo
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        {postType === "partida" ? (
          <span className="mr-auto text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
            Privada · só membros do clube
          </span>
        ) : (
          <VisibilityToggle
            options={visOptions}
            value={visibility}
            onChange={setVisibility}
          />
        )}
        <button
          type="submit"
          disabled={!canPublish}
          className={`rounded-lg toq-btn-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--toq-accent-hover)] disabled:opacity-50 ${
            inModal ? "min-w-[7.5rem]" : ""
          }`}
        >
          {loading || isSubmitting
            ? isEdit
              ? "Salvando…"
              : "Publicando…"
            : isEdit
              ? "Salvar alterações"
              : "Publicar"}
        </button>
      </div>
    </div>
  );

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className={
        inModal
          ? `create-post-box--modal toq-card-lg flex min-h-0 w-full max-h-full flex-1 flex-col overflow-hidden p-0 ${className}`
          : `toq-card-lg p-4 ${className}`
      }
    >
      {inModal ? (
        <>
          <div className="create-post-box__body min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {formBody}
          </div>
          <div className="create-post-box__footer shrink-0 border-t border-[var(--toq-border)] bg-[var(--toq-card)] p-4">
            {formActions}
          </div>
        </>
      ) : (
        <>
          {formBody}
          {formActions}
        </>
      )}
    </form>

    {activeCrop && (
      <PostImageCropModal
        open
        imageSrc={activeCrop.sourceUrl}
        onConfirm={(file, previewUrl) => {
          URL.revokeObjectURL(previewUrl);
          finishCropSession(file);
        }}
        onSkip={() => finishCropSession(activeCrop.sourceFile)}
        onCancel={() => finishCropSession(null)}
      />
    )}
    </>
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
      className={`inline-flex flex-wrap items-center gap-2 ${className}`}
      role="group"
      aria-label="Visibilidade do post"
    >
      <span className="text-[10px] font-medium text-[var(--toq-text-muted)]">Visibilidade</span>
      <div className="inline-flex rounded-lg border border-[var(--toq-border)] bg-[var(--toq-surface)] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
              value === opt.value
                ? "bg-[var(--toq-card)] text-[var(--toq-navy)] shadow-sm"
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
