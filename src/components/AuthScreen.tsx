"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFormPage } from "@/components/auth/AuthFormPage";
import { AuthSplash } from "@/components/auth/AuthSplash";
import { createClient } from "@/lib/supabase/client";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import { AvatarCropModal } from "@/components/profile/AvatarCropModal";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

type View = "login" | "register" | "forgot" | "reset" | "complete";
type Screen = "splash" | "auth";
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

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function AuthScreen() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView = ((): View => {
    if (searchParams.get("complete") === "1") return "complete";
    if (searchParams.get("reset") === "1") return "reset";
    if (searchParams.get("forgot") === "1") return "forgot";
    return "login";
  })();
  const skipSplash =
    initialView === "complete" || initialView === "reset" || initialView === "forgot";
  const [view, setView] = useState<View>(initialView);
  const [screen, setScreen] = useState<Screen>(skipSplash ? "auth" : "splash");
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
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender>("masculino");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Esqueci senha
  const [forgotEmail, setForgotEmail] = useState("");

  // Nova senha (link de recuperação)
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetChecking, setResetChecking] = useState(false);
  const [resetReady, setResetReady] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchParams.get("forgot") === "1") {
      setView("forgot");
      setScreen("auth");
    }
    if (searchParams.get("reset") === "1") {
      setView("reset");
      setScreen("auth");
    }
    if (searchParams.get("complete") === "1") {
      setView("complete");
      setScreen("auth");
    }
  }, [searchParams]);

  useEffect(() => {
    if (view !== "reset") return;

    let cancelled = false;
    setResetChecking(true);

    async function initRecovery() {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (type === "recovery" && accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(null, "", `${window.location.pathname}?reset=1`);
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setResetReady(!!data.session);
        setResetChecking(false);
      }
    }

    void initRecovery();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setResetReady(true);
        setResetChecking(false);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [view, supabase]);

  const resetMessages = useCallback(() => setMessage(null), []);

  const switchView = (next: View) => {
    resetMessages();
    setView(next);
  };

  const openAuth = useCallback(
    (next: View) => {
      resetMessages();
      setView(next);
      setScreen("auth");
    },
    [resetMessages],
  );

  const handleAuthBack = useCallback(() => {
    resetMessages();
    if (view === "forgot" || view === "reset") {
      setView("login");
      if (view === "reset") {
        router.replace("/", { scroll: false });
      }
      return;
    }
    setScreen("splash");
  }, [resetMessages, view, router]);

  function handleAvatarPick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    setCropSrc(URL.createObjectURL(file));
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function handleCropConfirm(file: File, previewUrl: string) {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
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

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error || !authData.user) {
        setMessage({ type: "error", text: "Credenciais inválidas. Verifique e tente novamente." });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_banned, profile_complete")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profile?.is_banned) {
        window.location.href = "/inicio/bloqueado";
        return;
      }
      if (profile && profile.profile_complete === false) {
        window.location.href = "/?complete=1";
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
          redirectTo: `${window.location.origin}/auth/callback?next=/inicio`,
        },
      });

      if (error) {
        setMessage({ type: "error", text: "Não foi possível conectar com o Google." });
      }
    });
  }

  async function handleCompleteProfile(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (loading) return;

    const normalizedUsername = normalizeUsername(username.trim());
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(normalizedUsername)) {
      setMessage({
        type: "error",
        text: "Nome de usuário: use de 3 a 30 caracteres (letras, números e _).",
      });
      return;
    }
    if (!birthDate) {
      setMessage({ type: "error", text: "Informe a data de nascimento." });
      return;
    }

    await guard(async () => {
      const { data: available, error: usernameError } = await supabase.rpc(
        "is_username_available",
        { p_username: normalizedUsername }
      );

      if (usernameError) {
        setMessage({ type: "error", text: "Não foi possível verificar o usuário." });
        return;
      }
      if (!available) {
        setMessage({ type: "error", text: "Este nome de usuário já está em uso." });
        return;
      }

      const { error } = await supabase.rpc("complete_profile_setup", {
        p_username: normalizedUsername,
        p_birth_date: birthDate,
        p_gender: gender,
      });

      if (error) {
        setMessage({
          type: "error",
          text: error.message || "Não foi possível salvar o perfil.",
        });
        return;
      }

      window.location.href = "/inicio";
    });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (loading) return;

    await guard(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(
        forgotEmail.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/?reset=1`,
        }
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

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    if (loading || !resetReady) return;

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "A nova senha deve ter no mínimo 8 caracteres." });
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      return;
    }

    await guard(async () => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setMessage({
          type: "error",
          text: "Não foi possível atualizar a senha. Solicite um novo link de recuperação.",
        });
        return;
      }

      await supabase.auth.signOut();
      setNewPassword("");
      setNewPasswordConfirm("");
      setResetReady(false);
      router.replace("/", { scroll: false });
      switchView("login");
      setMessage({
        type: "success",
        text: "Senha atualizada! Entre com sua nova senha.",
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

  const isDesktop = useIsDesktop();

  const formCard = (
    <>
    <section
      className={`auth-form-card pointer-events-auto w-full max-w-md rounded-2xl ${
        view === "register" || view === "complete"
          ? view === "complete"
            ? "auth-form-card--register auth-form-card--complete"
            : "auth-form-card--register"
          : view === "login"
            ? "auth-form-card--login"
          : view === "forgot" || view === "reset"
              ? "auth-form-card--forgot"
              : ""
      }`}
    >
          {view === "login" && (
            <div className="auth-login-intro mb-4">
              <h2 className="text-center text-base font-bold leading-snug text-[var(--toq-text)] md:text-lg">
                Conecte-se com outros jogadores
              </h2>
              <ToqLogoWithBalls className="mt-4 md:mt-5" />
            </div>
          )}

          {view === "forgot" && (
            <div className="mb-4">
              <ToqLogoWithBalls />
              <h2 className="mt-3 text-center text-base font-bold text-[var(--toq-text)] md:text-lg">
                Recuperar senha
              </h2>
            </div>
          )}

          {view === "reset" && (
            <div className="mb-4">
              <ToqLogoWithBalls />
              <h2 className="mt-3 text-center text-base font-bold text-[var(--toq-text)] md:text-lg">
                Nova senha
              </h2>
              <p className="mt-2 text-center text-sm text-[var(--toq-text-muted)]">
                Defina uma nova senha para sua conta.
              </p>
            </div>
          )}

          {view === "complete" && (
            <div className="auth-register-header mb-3 md:mb-4">
              <ToqLogoWithBalls className="auth-register-logo mt-2 md:mt-3" />
              <h2 className="mt-2 text-center text-base font-bold text-[var(--toq-text)] md:mt-3 md:text-lg">
                Complete seu perfil
              </h2>
              <p className="mt-2 text-center text-sm text-[var(--toq-text-muted)]">
                Escolha um nome de usuário e informe sua data de nascimento para continuar.
              </p>
            </div>
          )}

          {view === "register" && (
            <div className="auth-register-header mb-3 md:mb-4">
              <button
                type="button"
                onClick={() => switchView("login")}
                className="text-xs text-[var(--toq-text-muted)] hover:text-[var(--toq-accent)]"
              >
                ← Voltar ao login
              </button>
              <ToqLogoWithBalls className="auth-register-logo mt-2 md:mt-3" />
              <h2 className="mt-2 text-center text-base font-bold text-[var(--toq-text)] md:mt-3 md:text-lg">
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
            <form onSubmit={handleLogin} className="auth-login-form flex flex-col gap-2.5">
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
              <RegisterButton onClick={() => openAuth("register")} />
            </form>
          )}

          {view === "register" && (
            <form onSubmit={handleRegister} className="auth-register-form flex min-w-0 flex-col gap-1.5 md:gap-2">
              <Field
                label="Nome de usuário"
                id="username"
                value={username}
                onChange={(v) => setUsername(normalizeUsername(v))}
                autoComplete="username"
                hint="Letras, números e _. Espaços viram _ (ex.: Gabriel_Carrara)"
                required
              />
              <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
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
                label="Data de nascimento"
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={setBirthDate}
                required
              />
              <div className="auth-gender-field">
                <span className="auth-gender-label">Sexo</span>
                <div className="auth-gender-grid" role="radiogroup" aria-label="Sexo">
                  {GENDER_OPTIONS.map((o) => (
                    <label
                      key={o.value}
                      className={
                        gender === o.value
                          ? "border border-[var(--toq-accent)] toq-btn-primary text-white"
                          : "border border-slate-200 bg-white text-[var(--toq-text-muted)] hover:border-[var(--toq-accent)]"
                      }
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
              <div className="auth-avatar-picker rounded-lg border border-slate-200 bg-slate-50 p-2 md:p-3">
                <span className="mb-1 block text-[11px] font-medium text-[var(--toq-text-muted)] md:mb-2 md:text-xs">
                  Foto de perfil <span className="text-slate-400">(opcional)</span>
                </span>
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    src={avatarPreview}
                    name={username || "?"}
                    size="sm"
                    className="border border-slate-200 bg-white"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <input
                      ref={avatarInputRef}
                      id="avatar"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => handleAvatarPick(e.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="auth-avatar-add-btn rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[var(--toq-text-muted)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-[var(--toq-text)]"
                    >
                      Adicionar foto
                    </button>
                    {avatarFile && (
                      <p className="truncate text-[10px] text-[var(--toq-text-muted)]">{avatarFile.name}</p>
                    )}
                  </div>
                </div>
              </div>
              <SubmitButton loading={loading} label="Criar conta" tone="light" />
              <Divider />
              <GoogleButton loading={loading} onClick={handleGoogleLogin} />
            </form>
          )}

          {view === "complete" && (
            <form
              onSubmit={handleCompleteProfile}
              className="auth-register-form flex min-w-0 flex-col gap-1.5 md:gap-2"
            >
              <Field
                label="Nome de usuário"
                id="completeUsername"
                value={username}
                onChange={(v) => setUsername(normalizeUsername(v))}
                autoComplete="username"
                hint="Letras, números e _. Espaços viram _"
                required
              />
              <Field
                label="Data de nascimento"
                id="completeBirthDate"
                type="date"
                value={birthDate}
                onChange={setBirthDate}
                required
              />
              <div className="auth-gender-field">
                <span className="auth-gender-label">Sexo</span>
                <div className="auth-gender-grid" role="radiogroup" aria-label="Sexo">
                  {GENDER_OPTIONS.map((o) => (
                    <label
                      key={o.value}
                      className={
                        gender === o.value
                          ? "border border-[var(--toq-accent)] toq-btn-primary text-white"
                          : "border border-slate-200 bg-white text-[var(--toq-text-muted)] hover:border-[var(--toq-accent)]"
                      }
                    >
                      <input
                        type="radio"
                        name="completeGender"
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
              <SubmitButton loading={loading} label="Continuar" tone="light" />
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.replace("/");
                  switchView("login");
                }}
                className="w-full text-center text-xs text-[var(--toq-text-muted)] hover:text-[var(--toq-accent)]"
              >
                Sair e voltar ao login
              </button>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleForgot} className="auth-forgot-form flex flex-col gap-2.5">
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

          {view === "reset" && (
            <div className="auth-forgot-form flex flex-col gap-2.5">
              {resetChecking ? (
                <p className="text-center text-sm text-[var(--toq-text-muted)]">Verificando link…</p>
              ) : !resetReady ? (
                <>
                  <p className="text-sm text-[#ff6b6b]">
                    Link inválido ou expirado. Solicite uma nova recuperação de senha.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchView("forgot")}
                    className="w-full text-center text-xs font-semibold text-[var(--toq-accent)] hover:underline"
                  >
                    Recuperar senha novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView("login")}
                    className="w-full text-center text-xs text-[var(--toq-text-muted)] hover:text-[var(--toq-accent)]"
                  >
                    Voltar ao login
                  </button>
                </>
              ) : (
                <form onSubmit={handleResetPassword} className="flex flex-col gap-2.5">
                  <Field
                    label="Nova senha"
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <Field
                    label="Confirmar nova senha"
                    id="newPasswordConfirm"
                    type="password"
                    value={newPasswordConfirm}
                    onChange={setNewPasswordConfirm}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <SubmitButton loading={loading} label="Salvar nova senha" tone="light" />
                  <button
                    type="button"
                    onClick={() => switchView("login")}
                    className="w-full text-center text-xs text-[var(--toq-text-muted)] hover:text-[var(--toq-accent)]"
                  >
                    Voltar ao login
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      {cropSrc && (
        <AvatarCropModal
          open
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );

  if (isDesktop === null) {
    return <main className="auth-layout auth-layout--boot" />;
  }

  if (!isDesktop) {
    return (
      <main className={`auth-layout auth-layout--mobile auth-layout--${screen}`}>
        {screen === "splash" && (
          <AuthSplash
            onLogin={() => openAuth("login")}
            onRegister={() => openAuth("register")}
          />
        )}
        {screen === "auth" && (
          <AuthFormPage variant="mobile" onBack={handleAuthBack}>
            {formCard}
          </AuthFormPage>
        )}
      </main>
    );
  }

  return (
    <main className={`auth-layout auth-layout--desktop auth-layout--${screen}`}>
      {screen === "splash" && (
        <AuthSplash
          onLogin={() => openAuth("login")}
          onRegister={() => openAuth("register")}
        />
      )}
      {screen === "auth" && (
        <AuthFormPage variant="desktop" onBack={handleAuthBack}>
          {formCard}
        </AuthFormPage>
      )}
    </main>
  );
}

function ToqLogoWithBalls({ className = "" }: { className?: string }) {
  return (
    <div className={`auth-toq-logo-row flex items-center justify-center gap-2 md:gap-4 ${className}`}>
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
        className="auth-logo-mark h-[5.625rem] w-[11.25rem] shrink-0 toq-btn-primary bg-[var(--toq-accent)] md:h-[6.25rem] md:w-[13.75rem]"
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
    <div className="min-w-0">
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
        className={`toq-input w-full min-w-0 max-w-full px-3 py-2 text-sm text-[var(--toq-text)] outline-none focus:ring-2 focus:ring-[var(--toq-accent)]/20${
          type === "date" ? " auth-date-input" : ""
        }`}
      />
      {hint && (
        <p className="auth-field-hint mt-1 text-[10px] leading-snug text-[var(--toq-text-muted)]">{hint}</p>
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
