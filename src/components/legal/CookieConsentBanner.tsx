"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const COOKIE_CONSENT_KEY = "toq_cookie_consent";

export type CookieConsentValue = "accepted" | "essential";

function readConsent(): CookieConsentValue | null {
  try {
    const v = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (v === "accepted" || v === "essential") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function writeConsent(value: CookieConsentValue) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);
  }, []);

  function choose(value: CookieConsentValue) {
    writeConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-banner-title" aria-live="polite">
      <div className="cookie-banner__inner">
        <div className="cookie-banner__copy">
          <p id="cookie-banner-title" className="cookie-banner__title">
            Cookies e privacidade
          </p>
          <p className="cookie-banner__text">
            Usamos cookies essenciais para login e funcionamento do site, e preferências (como tema).
            Saiba mais na nossa{" "}
            <Link href="/cookies" className="cookie-banner__link">
              Política de Cookies
            </Link>
            .
          </p>
        </div>
        <div className="cookie-banner__actions">
          <button
            type="button"
            className="cookie-banner__btn cookie-banner__btn--ghost"
            onClick={() => choose("essential")}
          >
            Só essenciais
          </button>
          <button
            type="button"
            className="cookie-banner__btn cookie-banner__btn--primary"
            onClick={() => choose("accepted")}
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
