"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { BannerCourtLines } from "@/components/BannerCourtLines";
import { LoginPanelBackground } from "@/components/LoginPanelBackground";
import { BannerTennisBalls } from "@/components/BannerTennisBalls";
import { BannerOverlay } from "@/components/BannerOverlay";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type View = "login" | "register" | "forgot";
type Gender = "masculino" | "feminino" | "outro";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
];

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Apenas letras, números e _ — espaços viram underscore */
function normalizeUsername(value: string) {
  return value.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
}

export function AuthScreen() {
  const supabase = createClient();
  const [view, setView] = useState<View>("login");
  const { isSubmitting: loading, guard } = useSingleSubmit();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender>("masculino");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Esqueci senha
  const [forgotEmail, setForgotEmail] = useState("");

  const resetMessages = useCallback(() => setMessage(null), []);

  const switchView = (next: View) => {
    resetMessages();
    setView(next);
  };

  function handleAvatarChange(file: File | null) {
    setAvatarFile(file);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }

  async function resolveEmailForLogin(id: string): Promise<string | null> {
    const trimmed = id.trim();
    if (isEmail(trimmed)) return trimmed.toLowerCase();

    const { data, error } = await supabase.rpc("get_email_by_username", {
      p_username: trimmed,
    });

    if (error || !data) return null;
    return data as string;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (loading) return;

    await guard(async () => {
      const emailToUse = await resolveEmailForLogin(identifier);
      if (!emailToUse) {
        setMessage({ type: "error", text: "E-mail ou nome de usuário não encontrado." });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) {
        setMessage({ type: "error", text: "Credenciais inválidas. Verifique e tente novamente." });
        return;
      }

      window.location.href = "/inicio";
    });
  }

  async function handleGoogleLogin() {
    resetMessages();
    if (loading) return;

    await guard(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage({ type: "error", text: "Não foi possível conectar com o Google." });
      }
    });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (loading) return;

    await guard(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/callback?next=/?reset=1` }
      );

      if (error) {
        setMessage({ type: "error", text: "Não foi possível enviar o e-mail de recuperação." });
        return;
      }

      setMessage({
        type: "success",
        text: "Enviamos um link de recuperação para o seu e-mail.",
      });
    });
  }

  function validateRegister(normalizedUsername: string): string | null {
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalizedUsername)) {
      return "Nome de usuário: use de 3 a 30 caracteres (letras, números e _).";
    }
    if (!isEmail(email.trim())) return "Informe um e-mail válido.";
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
      return "Os e-mails não coincidem.";
    }
    if (registerPassword.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
    if (registerPassword !== registerPasswordConfirm) {
      return "As senhas não coincidem.";
    }
    if (!birthDate) return "Informe sua data de nascimento completa.";
    if (!gender) return "Selecione o sexo.";
    return null;
  }

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!avatarFile) return null;

    const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

    if (error) return null;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    const normalizedUsername = normalizeUsername(username.trim());

    const err = validateRegister(normalizedUsername);
    if (err) {
      setMessage({ type: "error", text: err });
      return;
    }

    if (normalizedUsername !== username.trim()) {
      setUsername(normalizedUsername);
    }

    if (loading) return;

    await guard(async () => {
      const { data: available, error: usernameError } = await supabase.rpc(
        "is_username_available",
        { p_username: normalizedUsername }
      );

      if (usernameError) {
        setMessage({
          type: "error",
          text: "Não foi possível validar o nome de usuário. Verifique se o SQL do Supabase foi executado.",
        });
        return;
      }

      if (!available) {
        setMessage({ type: "error", text: "Este nome de usuário já está em uso." });
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: registerPassword,
        options: {
          data: {
            username: normalizedUsername,
            email: email.trim().toLowerCase(),
            birth_date: birthDate,
            gender,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setMessage({
          type: "error",
          text: signUpError.message.includes("already")
            ? "Este e-mail já está cadastrado."
            : "Não foi possível concluir o cadastro.",
        });
        return;
      }

      const userId = signUpData.user?.id;
      if (userId && avatarFile) {
        const avatarUrl = await uploadAvatar(userId);
        if (avatarUrl) {
          await supabase
            .from("profiles")
            .update({ avatar_url: avatarUrl })
            .eq("id", userId);
        }
      }

      if (signUpData.session) {
        window.location.href = "/inicio";
        return;
      }

      setMessage({
        type: "success",
        text: "Cadastro realizado! Confirme seu e-mail para entrar.",
      });
      switchView("login");
    });
  }

  const showBannerPanel = view === "login" || view === "register";

  return (
    <main className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden md:flex-row">
      {/* Painel esquerdo — azul céu (banner) */}
      <aside
        className={`auth-panel-sky relative shrink-0 overflow-hidden md:w-1/2 md:border-r-2 md:border-[var(--toq-navy)] md:h-dvh lg:w-[48%] ${
          showBannerPanel
            ? "h-[50dvh] border-b-2 border-[var(--toq-navy)] md:border-b-0"
            : "hidden"
        }`}
      >
        {showBannerPanel && (
          <div className="relative h-full w-full overflow-hidden">
            <Image
              src="/imagens_publicas/logo_transp.png"
              alt="Toq Tennis"
              width={160}
              height={80}
              priority
              className="absolute left-3 top-3 z-20 h-auto w-[4.5rem] md:left-5 md:top-5 md:w-24"
            />
            <BannerCourtLines />
            <BannerTennisBalls />
            <div className="relative z-[2] flex h-full w-full flex-col items-center">
              <Image
                src="/imagens_publicas/banner_principal.png?v=4"
                alt=""
                width={1084}
                height={1451}
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="mt-auto block h-auto max-h-full w-auto max-w-full object-contain object-bottom"
                aria-hidden
              />
            </div>
            <BannerOverlay />
          </div>
        )}
      </aside>

      {/* Painel direito — login */}
      <div
        className="auth-panel-login relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 py-6 md:px-10 lg:px-14"
      >
        <div className="absolute inset-0 z-0">
          <LoginPanelBackground />
        </div>

        <section
          className={`auth-form-card relative z-10 w-full max-w-md rounded-2xl ${
            view === "register"
              ? "max-h-[min(88dvh,640px)] overflow-y-auto p-4 md:p-5"
              : "p-5 md:p-6"
          }`}
        >
          {view === "login" && (
            <div className="mb-4">
              <h2 className="text-center text-base font-bold leading-snug text-[var(--toq-text)] md:text-lg">
                Conecte-se com outros jogadores
              </h2>
              <div className="mt-4 flex items-center justify-center gap-2 md:mt-5 md:gap-4">
                <div className="auth-ball-spin auth-ball-frame relative h-8 w-8 shrink-0 md:h-9 md:w-9">
                  <Image
                    src="/imagens_publicas/bola_tenis.png?v=5"
                    alt=""
                    fill
                    sizes="36px"
                    className="auth-ball-img object-cover"
                    aria-hidden
                  />
                </div>
                <div
                  className="h-[5.625rem] w-[11.25rem] shrink-0 toq-btn-primary bg-[var(--toq-accent)] md:h-[6.25rem] md:w-[13.75rem]"
                  style={{
                    maskImage: "url(/imagens_publicas/logo_transp.png)",
                    WebkitMaskImage: "url(/imagens_publicas/logo_transp.png)",
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskPosition: "center",
                  }}
                  role="img"
                  aria-label="Toq Tennis"
                />
                <div className="auth-ball-spin--reverse auth-ball-frame relative h-8 w-8 shrink-0 md:h-9 md:w-9">
                  <Image
                    src="/imagens_publicas/bola_tenis.png?v=5"
                    alt=""
                    fill
                    sizes="36px"
                    className="auth-ball-img object-cover"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          )}

          {view === "register" && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => switchView("login")}
                className="text-xs text-[var(--toq-text-muted)] hover:text-[var(--toq-accent)]"
              >
                ← Voltar ao login
              </button>
              <h2 className="mt-2 text-center text-lg font-bold text-[var(--toq-text)]">
                Criar conta
              </h2>
            </div>
          )}

          {message && (
            <p
              role="alert"
              className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                message.type === "error"
                  ? "bg-red-500/20 text-[#ff6b6b]"
                  : "bg-emerald-500/20 text-[#4ade80]"
              }`}
            >
              {message.text}
            </p>
          )}

          {view === "login" && (
            <form onSubmit={handleLogin} className="space-y-3">
              <Field
                label="E-mail ou usuário"
                id="identifier"
                value={identifier}
                onChange={setIdentifier}
                autoComplete="username"
                required
              />
              <Field
                label="Senha"
                id="password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => switchView("forgot")}
                className="text-xs text-[var(--toq-text-muted)] underline-offset-2 hover:text-[var(--toq-accent)] hover:underline"
              >
                Esqueci minha senha
              </button>
              <SubmitButton loading={loading} label="Entrar" tone="light" />
              <Divider />
              <GoogleButton loading={loading} onClick={handleGoogleLogin} />
              <RegisterButton onClick={() => switchView("register")} />
            </form>
          )}

          {view === "register" && (
            <form onSubmit={handleRegister} className="space-y-2">
              <Field
                label="Nome de usuário"
                id="username"
                value={username}
                onChange={(v) => setUsername(normalizeUsername(v))}
                autoComplete="username"
                hint="Letras, números e _. Espaços viram _ (ex.: Gabriel_Carrara)"
                required
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field
                  label="E-mail"
                  id="email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  required
                />
                <Field
                  label="Confirmar e-mail"
                  id="emailConfirm"
                  type="email"
                  value={emailConfirm}
                  onChange={setEmailConfirm}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field
                  label="Senha (mín. 8 dígitos)"
                  id="registerPassword"
                  type="password"
                  value={registerPassword}
                  onChange={setRegisterPassword}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <Field
                  label="Confirmar senha"
                  id="registerPasswordConfirm"
                  type="password"
                  value={registerPasswordConfirm}
                  onChange={setRegisterPasswordConfirm}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
                <Field
                  label="Data de nascimento"
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={setBirthDate}
                  required
                />
                <div>
                  <span className="mb-1 block text-xs font-medium text-[var(--toq-text-muted)]">
                    Sexo
                  </span>
                  <div className="grid h-[38px] grid-cols-3 gap-1">
                    {GENDER_OPTIONS.map((o) => (
                      <label
                        key={o.value}
                        className={`flex cursor-pointer items-center justify-center rounded-lg border text-center text-[11px] font-medium leading-tight transition sm:text-xs ${
                          gender === o.value
                            ? "border-[var(--toq-accent)] toq-btn-primary text-white"
                            : "border-slate-200 bg-white text-[var(--toq-text-muted)] hover:border-[var(--toq-accent)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="gender"
                          value={o.value}
                          checked={gender === o.value}
                          onChange={() => setGender(o.value)}
                          className="sr-only"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="mb-2 block text-xs font-medium text-[var(--toq-text-muted)]">
                  Foto de perfil <span className="text-slate-400">(opcional)</span>
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreview}
                        alt="Prévia da foto"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-[var(--toq-text-muted)]">Sem foto</span>
                    )}
                  </div>
                  <input
                    id="avatar"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                    className="min-w-0 flex-1 text-xs file:mr-2 file:rounded file:border-0 file:toq-btn-primary file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white file:hover:bg-[var(--toq-accent-hover)]"
                  />
                </div>
              </div>
              <SubmitButton loading={loading} label="Criar conta" tone="light" />
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-3">
              <p className="text-sm text-[var(--toq-text-muted)]">
                Informe o e-mail da sua conta para receber o link de redefinição.
              </p>
              <Field
                label="E-mail"
                id="forgotEmail"
                type="email"
                value={forgotEmail}
                onChange={setForgotEmail}
                autoComplete="email"
                required
              />
              <SubmitButton loading={loading} label="Enviar link" />
              <button
                type="button"
                onClick={() => switchView("login")}
                className="w-full text-center text-xs text-[var(--toq-text-muted)] hover:text-[var(--toq-accent)]"
              >
                Voltar ao login
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  minLength,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--toq-text-muted)]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="toq-input w-full px-3 py-2 text-sm text-[var(--toq-text)] outline-none focus:ring-2 focus:ring-[var(--toq-accent)]/20"
      />
      {hint && (
        <p className="mt-1 text-[10px] leading-snug text-[var(--toq-text-muted)]">{hint}</p>
      )}
    </div>
  );
}

function SubmitButton({
  loading,
  label,
  tone = "default",
  className = "",
}: {
  loading: boolean;
  label: string;
  tone?: "default" | "light";
  className?: string;
}) {
  const toneClass =
    tone === "light"
      ? "toq-btn-primary bg-[var(--toq-accent)] hover:bg-[var(--toq-accent-hover)]"
      : "toq-btn-primary hover:opacity-90";

  return (
    <button
      type="submit"
      disabled={loading}
      className={`w-full rounded-lg py-2.5 text-sm font-bold text-[var(--toq-navy)] transition disabled:opacity-60 ${toneClass} ${className}`}
    >
      {loading ? "Aguarde…" : label}
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs text-[var(--toq-text-muted)]">ou</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function GoogleButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="toq-btn-outline flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-5.514 0-10-4.486-10-10s4.486-10 10-10c2.837 0 5.386 1.194 7.207 3.093l5.657-5.657C34.047 10.846 29.268 9 24 9 12.955 9 4 17.955 4 29s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
        <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c2.837 0 5.386 1.194 7.207 3.093l5.657-5.657C34.047 10.846 29.268 9 24 9c-7.682 0-14.348 4.733-17.418 11.291z" />
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
      </svg>
      Continuar com Google
    </button>
  );
}

function RegisterButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="toq-btn-outline w-full rounded-xl border-[var(--toq-accent)] py-2.5 text-sm font-semibold text-[var(--toq-accent)] transition hover:bg-[var(--toq-accent-soft)]"
    >
      Criar uma conta
    </button>
  );
}
