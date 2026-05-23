"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  GENDER_OPTIONS,
  normalizeUsername,
  validateUsername,
  type GenderType,
} from "@/lib/profile";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { type AddressFields, EMPTY_ADDRESS, addressToDbPayload } from "@/lib/address";
import { AddressForm } from "@/components/shared/AddressForm";

export type EditableProfile = {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  birth_date: string;
  gender: GenderType;
  bio: string;
  created_at: string;
  address: AddressFields;
};

type Props = {
  initial: EditableProfile;
  onSaved?: () => void;
};

export function ProfileEditForm({ initial, onSaved }: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(initial.username);
  const [birthDate, setBirthDate] = useState(initial.birth_date);
  const [gender, setGender] = useState<GenderType>(initial.gender);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [address, setAddress] = useState<AddressFields>(initial.address ?? EMPTY_ADDRESS);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial.avatar_url);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const { isSubmitting: saving, guard } = useSingleSubmit();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarFile && avatarPreview && avatarPreview !== initial.avatar_url) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarFile, avatarPreview, initial.avatar_url]);

  function handleAvatarChange(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (avatarFile && avatarPreview && avatarPreview !== initial.avatar_url) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!avatarFile) return initial.avatar_url;

    const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

    if (uploadErr) return null;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalized = normalizeUsername(username.trim());
    const usernameErr = validateUsername(normalized);
    if (usernameErr) {
      setError(usernameErr);
      return;
    }

    if (!birthDate) {
      setError("Informe a data de nascimento.");
      return;
    }

    const trimmedBio = bio.slice(0, 1000);

    if (saving) return;

    await guard(async () => {
      const usernameChanged =
        normalized.toLowerCase() !== initial.username.toLowerCase();

      if (usernameChanged) {
        const { data: available, error: checkErr } = await supabase.rpc(
          "is_username_available",
          { p_username: normalized }
        );

        if (checkErr) {
          setError("Não foi possível verificar o nome de usuário.");
          return;
        }

        if (!available) {
          setError("Este nome de usuário já está em uso.");
          return;
        }
      }

      const avatarUrl = await uploadAvatar(initial.id);

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          username: normalized,
          birth_date: birthDate,
          gender,
          bio: trimmedBio,
          avatar_url: avatarUrl,
          ...addressToDbPayload(address),
        })
        .eq("id", initial.id);

      if (updateErr) {
        if (updateErr.code === "23505") {
          setError("Este nome de usuário já está em uso.");
        } else {
          setError(updateErr.message || "Não foi possível salvar o perfil.");
        }
        return;
      }

      setSuccess("Perfil atualizado com sucesso.");
      setAvatarFile(null);
      onSaved?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700" role="status">
          {success}
        </p>
      )}

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview}
              alt=""
              className="h-24 w-24 rounded-full object-cover ring-4 ring-[var(--toq-lime-light)]/40"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--toq-sky)] text-3xl font-bold text-white">
              {username.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleAvatarChange(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[var(--toq-navy)] hover:bg-slate-50"
          >
            Alterar foto de perfil
          </button>
          <p className="mt-1 text-[10px] text-[var(--toq-text-muted)]">JPG, PNG ou WebP · máx. 5 MB</p>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome de usuário</span>
        <input
          value={username}
          onChange={(e) => setUsername(normalizeUsername(e.target.value))}
          maxLength={30}
          required
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
      </label>

      <p className="text-xs text-[var(--toq-text-muted)]">
        E-mail: <span className="font-medium text-[var(--toq-navy)]">{initial.email}</span> (não
        editável)
      </p>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Data de nascimento</span>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
      </label>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--toq-navy)]">Sexo</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {GENDER_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="gender"
                checked={gender === opt.value}
                onChange={() => setGender(opt.value)}
              />
              <span className="text-sm text-[var(--toq-navy)]">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <AddressForm value={address} onChange={setAddress} />

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 1000))}
          rows={4}
          maxLength={1000}
          placeholder="Conte um pouco sobre você, seu nível de jogo, clubes que frequenta…"
          className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
        <span className="mt-1 block text-right text-[10px] text-[var(--toq-text-muted)]">
          {bio.length}/1000
        </span>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-[var(--toq-lime-light)] py-2.5 text-sm font-bold text-[var(--toq-navy)] transition hover:bg-[var(--toq-lime-bright)] disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {saving ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
