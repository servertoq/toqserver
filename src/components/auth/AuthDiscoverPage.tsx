"use client";

import Image from "next/image";
import { AuthDiscoverContent } from "./AuthDiscoverContent";
import { AUTH_HERO_IMAGE } from "./authLandingData";

type Props = {
  variant: "mobile" | "desktop";
  onBack: () => void;
  onLogin: () => void;
  onRegister: () => void;
};

const logoMask = {
  maskImage: "url(/imagens_publicas/logo_transp.png)",
  WebkitMaskImage: "url(/imagens_publicas/logo_transp.png)",
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "left center",
  WebkitMaskPosition: "left center",
} as const;

export function AuthDiscoverPage({ variant, onBack, onLogin, onRegister }: Props) {
  return (
    <div className={`auth-discover-page auth-discover-page--${variant}`}>
      {variant === "desktop" && (
        <>
          <div className="auth-splash-panorama" aria-hidden>
            <Image
              src={AUTH_HERO_IMAGE}
              alt=""
              fill
              priority
              sizes="100vw"
              className="auth-pano-bg object-cover"
              aria-hidden
            />
          </div>
          <div className="auth-discover-page-overlay" aria-hidden />
          <div className="auth-discover-page-mesh" aria-hidden />
        </>
      )}

      <header className="auth-discover-topbar">
        <button type="button" className="auth-discover-back" onClick={onBack}>
          ← Voltar
        </button>
        <div className="auth-discover-topbar-logo" style={logoMask} role="img" aria-label="Toq Tennis" />
        <span className="auth-discover-topbar-spacer" aria-hidden />
      </header>

      <div className="auth-discover-scroll">
        <AuthDiscoverContent variant={variant} showHeadline={variant === "mobile"} />
      </div>

      <footer className="auth-discover-footer">
        <button type="button" className="auth-discover-footer-btn auth-discover-footer-btn--ghost" onClick={onLogin}>
          Entrar
        </button>
        <button type="button" className="auth-discover-footer-btn auth-discover-footer-btn--primary" onClick={onRegister}>
          Criar conta
        </button>
      </footer>
    </div>
  );
}
