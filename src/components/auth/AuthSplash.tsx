"use client";

import Image from "next/image";
import { useCallback, useRef } from "react";
import { AuthFeatureGrid } from "./AuthFeatureGrid";
import { AuthHowItWorks } from "./AuthHowItWorks";
import { AuthPersonaCards } from "./AuthPersonaCards";
import { AuthPlansSection } from "./AuthPlansSection";
import { AUTH_HERO_IMAGE } from "./authLandingData";

type Props = {
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
  maskPosition: "center",
  WebkitMaskPosition: "center",
} as const;

export function AuthSplash({ onLogin, onRegister }: Props) {
  const discoverRef = useRef<HTMLElement>(null);

  const scrollToDiscover = useCallback(() => {
    discoverRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="auth-landing">
      <section className="auth-splash-hero">
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

        <div className="auth-splash-overlay" aria-hidden />
        <div className="auth-splash-mesh" aria-hidden />

        <div className="auth-splash-content">
          <div className="auth-splash-logo" style={logoMask} role="img" aria-label="Toq Tennis" />

          <div className="auth-splash-copy">
            <p className="auth-splash-eyebrow">Toq Tennis</p>
            <h1 className="auth-splash-title">Evolua no tênis com quem joga de verdade</h1>
            <p className="auth-splash-sub">
              Partidas, aulas, arenas e comunidade em um só lugar.
            </p>
          </div>

          <div className="auth-splash-actions">
            <button type="button" className="auth-splash-btn auth-splash-btn--primary" onClick={onLogin}>
              Entrar
            </button>
            <button type="button" className="auth-splash-btn auth-splash-btn--secondary" onClick={onRegister}>
              Criar conta
            </button>
          </div>

          <button type="button" className="auth-splash-discover" onClick={scrollToDiscover}>
            Conheça a plataforma
            <span aria-hidden>→</span>
          </button>
        </div>

        <button type="button" className="auth-scroll-hint" onClick={scrollToDiscover} aria-label="Role para descobrir">
          <span className="auth-scroll-hint-text">Role para descobrir</span>
          <span className="auth-scroll-hint-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </section>

      <section ref={discoverRef} id="landing-discover" className="auth-landing-section">
        <div className="auth-landing-section-inner">
          <header className="auth-landing-section-header">
            <p className="auth-landing-eyebrow">Para quem é</p>
            <h2 className="auth-landing-section-title">O ecossistema do tênis é para você</h2>
            <p className="auth-landing-section-lead">
              Jogadores, professores e donos de arena — cada um com ferramentas pensadas para o seu objetivo.
            </p>
          </header>
          <AuthPersonaCards />
        </div>
      </section>

      <section className="auth-landing-section auth-landing-section--alt">
        <div className="auth-landing-section-inner">
          <header className="auth-landing-section-header">
            <p className="auth-landing-eyebrow">Vantagens</p>
            <h2 className="auth-landing-section-title">Por que escolher a TOQ</h2>
            <p className="auth-landing-section-lead">
              Pagamento garantido, match inteligente, rede social e muito mais — tudo integrado.
            </p>
          </header>
          <AuthFeatureGrid />
        </div>
      </section>

      <section className="auth-landing-section">
        <div className="auth-landing-section-inner">
          <header className="auth-landing-section-header">
            <p className="auth-landing-eyebrow">Como funciona</p>
            <h2 className="auth-landing-section-title">Simples de começar</h2>
            <p className="auth-landing-section-lead">
              Em poucos passos você já está conectado à comunidade do tênis brasileiro.
            </p>
          </header>
          <AuthHowItWorks />
        </div>
      </section>

      <section className="auth-landing-section auth-landing-section--alt">
        <div className="auth-landing-section-inner">
          <header className="auth-landing-section-header">
            <p className="auth-landing-eyebrow">Planos</p>
            <h2 className="auth-landing-section-title">Escolha como quer crescer na TOQ</h2>
            <p className="auth-landing-section-lead">
              Comece grátis. Evolua para Professor ou Empresário quando fizer sentido — pague só a
              diferença ao mudar de plano.
            </p>
          </header>
          <AuthPlansSection onRegister={onRegister} />
        </div>
      </section>

      <section className="auth-landing-cta">
        <div className="auth-landing-section-inner auth-landing-cta-inner">
          <h2 className="auth-landing-cta-title">Pronto para evoluir no tênis?</h2>
          <p className="auth-landing-cta-lead">Crie sua conta ou entre agora e faça parte da rede.</p>
          <div className="auth-landing-cta-actions">
            <button type="button" className="auth-splash-btn auth-splash-btn--primary" onClick={onLogin}>
              Entrar
            </button>
            <button type="button" className="auth-splash-btn auth-splash-btn--secondary" onClick={onRegister}>
              Criar conta
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
