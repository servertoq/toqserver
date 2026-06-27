"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUPPORT_TOPICS, supportTopicLabel, uploadSupportImage } from "@/lib/support";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { SupportTopic } from "@/types/support";

type Props = {
  userId: string;
};

export function ProfileSupportForm({ userId }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [topic, setTopic] = useState<SupportTopic | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { isSubmitting: saving, guard } = useSingleSubmit();

  function resetForm() {
    setTopic(null);
    setTitle("");
    setDescription("");
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setError(null);
    setSuccess(false);
  }

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

  async function uploadImage(ticketId: string): Promise<string | null> {
    if (!imageFile) return null;
    return uploadSupportImage(supabase, userId, ticketId, imageFile);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic) {
      setError("Selecione um tópico.");
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      setError("Informe um título com pelo menos 3 caracteres.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError("Descreva o assunto com pelo menos 10 caracteres.");
      return;
    }

    await guard(async () => {
      setError(null);

      const ticketId = crypto.randomUUID();
      let imageUrl: string | null = null;

      if (imageFile) {
        imageUrl = await uploadImage(ticketId);
        if (!imageUrl) {
          setError("Não foi possível enviar a imagem. Tente novamente.");
          return;
        }
      }

      const { error: insertErr } = await supabase.from("support_tickets").insert({
        id: ticketId,
        user_id: userId,
        topic,
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl,
      });

      if (insertErr) {
        setError(insertErr.message);
        return;
      }

      setSuccess(true);
    });
  }

  if (success && topic) {
    return (
      <div className="rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-profile-accent-soft)]/40 px-6 py-10 text-center">
        <p className="text-3xl" aria-hidden>
          ✓
        </p>
        <p className="mt-3 text-base font-bold text-[var(--toq-profile-navy)]">
          Mensagem enviada com sucesso
        </p>
        <p className="mt-2 text-sm text-[var(--toq-profile-muted)]">
          Recebemos sua {supportTopicLabel(topic).toLowerCase()}. Nossa equipe analisará em breve.
        </p>
        <button
          type="button"
          onClick={resetForm}
          className="mt-6 rounded-xl bg-[var(--toq-profile-accent)] px-5 py-2.5 text-sm font-bold text-white"
        >
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="space-y-4">
        <div>
          <p className="profile-section-label">Suporte Toq Tennis</p>
          <p className="mt-2 text-sm text-[var(--toq-profile-muted)]">
            Como podemos ajudar? Escolha o tipo de solicitação abaixo.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SUPPORT_TOPICS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTopic(item.id)}
              className="flex flex-col items-start rounded-2xl border border-[var(--toq-profile-border)] bg-white p-4 text-left transition hover:border-[var(--toq-profile-accent)] hover:shadow-sm"
            >
              <span className="text-2xl" aria-hidden>
                {item.emoji}
              </span>
              <span className="mt-3 text-sm font-bold text-[var(--toq-profile-navy)]">
                {item.label}
              </span>
              <span className="mt-1 text-xs leading-relaxed text-[var(--toq-profile-muted)]">
                {item.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedTopic = SUPPORT_TOPICS.find((t) => t.id === topic)!;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="profile-section-label">Suporte — {selectedTopic.label}</p>
          <p className="mt-1 text-sm text-[var(--toq-profile-muted)]">{selectedTopic.description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setTopic(null);
            setError(null);
          }}
          className="text-sm font-semibold text-[var(--toq-profile-accent)] hover:underline"
        >
          ← Trocar tópico
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-profile-navy)]">Título</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          placeholder="Resumo do assunto"
          className="mt-1 w-full rounded-xl border border-[var(--toq-profile-border)] px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-profile-navy)]">Descrição</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={5}
          maxLength={4000}
          placeholder="Conte os detalhes para que possamos ajudar melhor…"
          className="mt-1 w-full rounded-xl border border-[var(--toq-profile-border)] px-3 py-2.5 text-sm"
        />
      </label>

      <div>
        <span className="text-xs font-semibold text-[var(--toq-profile-navy)]">
          Imagem (opcional)
        </span>
        <p className="mt-0.5 text-[11px] text-[var(--toq-profile-muted)]">
          Anexe um print ou foto que ajude a entender o caso.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {imagePreview ? (
            <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-[var(--toq-profile-border)]">
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
              className="rounded-xl border border-dashed border-[var(--toq-profile-border)] px-4 py-3 text-xs font-semibold text-[var(--toq-profile-muted)] hover:border-[var(--toq-profile-accent)] hover:text-[var(--toq-profile-accent)]"
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

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-[var(--toq-profile-accent)] py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {saving ? "Enviando…" : "Enviar solicitação"}
      </button>
    </form>
  );
}
