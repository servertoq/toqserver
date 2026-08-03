"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { reportTargetHeading, uploadSupportImage } from "@/lib/support";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { ReportTarget } from "@/types/support";

type Props = {
  open: boolean;
  target: ReportTarget;
  userId: string;
  onClose: () => void;
};

export function ReportDialog({ open, target, userId, onClose }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { isSubmitting: saving, guard } = useSingleSubmit();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, saving, onClose]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setImageFile(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setError(null);
      setSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset só ao fechar
  }, [open]);

  if (!open || !mounted) return null;

  function handleImageChange(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      setError("Informe um título com pelo menos 3 caracteres.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError("Descreva o motivo com pelo menos 10 caracteres.");
      return;
    }

    await guard(async () => {
      setError(null);
      const ticketId = crypto.randomUUID();
      let imageUrl: string | null = null;

      if (imageFile) {
        imageUrl = await uploadSupportImage(supabase, userId, ticketId, imageFile);
        if (!imageUrl) {
          setError("Não foi possível enviar a imagem. Tente novamente.");
          return;
        }
      }

      const { error: insertErr } = await supabase.from("support_tickets").insert({
        id: ticketId,
        user_id: userId,
        topic: "report",
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl,
        target_type: target.type,
        target_id: target.id,
      });

      if (insertErr) {
        setError(insertErr.message);
        return;
      }

      setSuccess(true);
    });
  }

  const footerPad =
    "shrink-0 border-t border-[var(--toq-border)] px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]";

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        className="flex max-h-[min(92dvh,100%)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-[0_16px_48px_rgba(5,16,36,0.14)] sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--toq-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="report-dialog-title" className="text-base font-bold text-[var(--toq-navy)]">
              {reportTargetHeading(target.type)}
            </h2>
            <p className="mt-0.5 truncate text-xs text-[var(--toq-text-muted)]">{target.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 text-sm font-semibold text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)] disabled:opacity-50"
          >
            Fechar
          </button>
        </div>

        {success ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 text-center [-webkit-overflow-scrolling:touch]">
              <p className="text-3xl" aria-hidden>
                ✓
              </p>
              <p className="mt-3 text-sm font-bold text-[var(--toq-navy)]">Denúncia enviada</p>
              <p className="mt-2 text-xs text-[var(--toq-text-muted)]">
                Obrigado por ajudar a manter a comunidade segura. Analisaremos em breve.
              </p>
            </div>
            <div className={footerPad}>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl toq-btn-primary py-3 text-sm font-bold text-white"
              >
                Ok
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Título</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={120}
                  placeholder="Resumo da denúncia"
                  className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Descrição</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  maxLength={4000}
                  placeholder="Explique o que aconteceu e por que está denunciando…"
                  className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm"
                />
              </label>

              <div>
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Imagem (opcional)</span>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {imagePreview ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-[var(--toq-border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                        aria-label="Remover imagem"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-xl border border-dashed border-[var(--toq-border)] px-4 py-2.5 text-xs font-semibold text-[var(--toq-text-muted)] hover:border-[var(--toq-accent)] hover:text-[var(--toq-accent)]"
                    >
                      + Adicionar imagem
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e.target.files)}
                  />
                </div>
              </div>
            </div>

            <div className={footerPad}>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Enviando…" : "Enviar denúncia"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
