"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { AUTH_HERO_IMAGE } from "./authLandingData";

type Props = {
  variant: "mobile" | "desktop";
  onBack: () => void;
  children: ReactNode;
};

export function AuthFormPage({ variant, onBack, children }: Props) {
  return (
    <div className={`auth-form-page auth-form-page--${variant}`}>
      <Image
        src={AUTH_HERO_IMAGE}
        alt=""
        fill
        priority
        sizes="100vw"
        className="auth-form-page-bg object-cover"
        aria-hidden
      />
      <div className="auth-form-page-scrim" aria-hidden />

      <button type="button" className="auth-form-back" onClick={onBack}>
        ← Voltar
      </button>

      <div className="auth-form-page-body">
        <div className="auth-form-page-wrap">{children}</div>
      </div>
    </div>
  );
}
