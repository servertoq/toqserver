"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef } from "react";
import { LEGAL_NAV, LEGAL_SITE } from "@/lib/legal/site";
import { SiteContactLinks } from "@/components/legal/SiteContactLinks";
import { AuthFeatureGrid } from "./AuthFeatureGrid";
import { AuthFaqSection } from "./AuthFaqSection";
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
            <h2 className="auth-landing-section-title">Jogador, professor ou arena</h2>
            <p className="auth-landing-section-lead">
              Cada perfil encontra o essencial: partidas, aulas ou gestão de quadras.
            </p>
          </header>
          <AuthPersonaCards />
        </div>
      </section>

      <section className="auth-landing-section auth-landing-section--alt">
        <div className="auth-landing-section-inner">
          <header className="auth-landing-section-header">
            <p className="auth-landing-eyebrow">Na prática</p>
            <h2 className="auth-landing-section-title">O que a TOQ resolve</h2>
            <p className="auth-landing-section-lead">
              Match, pagamento, clubes e divulgação — sem espalhar em várias ferramentas.
            </p>
          </header>
          <AuthFeatureGrid />
        </div>
      </section>

      <section className="auth-landing-section">
        <div className="auth-landing-section-inner">
          <header className="auth-landing-section-header">
            <p className="auth-landing-eyebrow">Passo a passo</p>
            <h2 className="auth-landing-section-title">Como começar</h2>
            <p className="auth-landing-section-lead">
              Cadastro rápido. Depois é conectar e jogar.
            </p>
          </header>
          <AuthHowItWorks />
        </div>
      </section>

      <section className="auth-landing-section auth-landing-section--alt">
        <div className="auth-landing-section-inner">
          <header className="auth-landing-section-header">
            <p className="auth-landing-eyebrow">Planos</p>
            <h2 className="auth-landing-section-title">Preços transparentes</h2>
            <p className="auth-landing-section-lead">
              Comece grátis. Troque de plano quando quiser — no upgrade, só a diferença.
            </p>
          </header>
          <AuthPlansSection onRegister={onRegister} />
        </div>
      </section>

      <section className="auth-landing-section">
        <div className="auth-landing-section-inner">
          <header className="auth-landing-section-header">
            <p className="auth-landing-eyebrow">Dúvidas</p>
            <h2 className="auth-landing-section-title">Perguntas frequentes</h2>
            <p className="auth-landing-section-lead">
              Uso, instalação, integração com o sistema do clube e atualizações.
            </p>
          </header>
          <AuthFaqSection />
        </div>
      </section>

      <section className="auth-landing-cta">
        <div className="auth-landing-section-inner auth-landing-cta-inner">
          <h2 className="auth-landing-cta-title">Entre na TOQ</h2>
          <p className="auth-landing-cta-lead">Crie sua conta ou faça login para continuar.</p>
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

      <footer className="auth-landing-footer">
        <div className="auth-landing-section-inner auth-landing-footer-inner">
          <div className="auth-landing-footer-grid">
            <div className="auth-landing-footer-brand">
              <Link href="/" className="auth-landing-footer-logo-link" aria-label={LEGAL_SITE.brand}>
                <span
                  className="auth-landing-footer-logo"
                  style={{
                    maskImage: "url(/imagens_publicas/logo_transp.png)",
                    WebkitMaskImage: "url(/imagens_publicas/logo_transp.png)",
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "left center",
                    WebkitMaskPosition: "left center",
                  }}
                  aria-hidden
                />
              </Link>
              <p className="auth-landing-footer-tagline">
                Rede social e plataforma do tênis — partidas, aulas, arenas e comunidade.
              </p>
            </div>

            <div className="auth-landing-footer-col">
              <p className="auth-landing-footer-heading">Legal</p>
              <nav className="auth-landing-footer-nav" aria-label="Documentos legais">
                {LEGAL_NAV.map((item) => (
                  <Link key={item.id} href={item.href} className="auth-landing-footer-link">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="auth-landing-footer-col">
              <p className="auth-landing-footer-heading">Contato</p>
              <SiteContactLinks />
            </div>
          </div>

          <div className="auth-landing-footer-bottom">
            <p className="auth-landing-footer-meta">
              © {new Date().getFullYear()} {LEGAL_SITE.brand}. Tratamos dados pessoais conforme a LGPD
              (Lei nº 13.709/2018). Consulte a{" "}
              <Link href="/privacidade" className="auth-landing-footer-link-inline">
                Política de Privacidade
              </Link>{" "}
              e os{" "}
              <Link href="/termos" className="auth-landing-footer-link-inline">
                Termos de uso
              </Link>
              . Contato do titular:{" "}
              <a href={`mailto:${LEGAL_SITE.contactEmail}`} className="auth-landing-footer-link-inline">
                {LEGAL_SITE.contactEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
