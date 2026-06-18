"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTH_PERSONAS, type PersonaId } from "./authLandingData";

type Props = {
  variant?: "desktop" | "mobile";
};

const ROTATE_MS = 6000;

export function AuthPersonaShowcase({ variant = "desktop" }: Props) {
  const [active, setActive] = useState<PersonaId>("player");
  const [paused, setPaused] = useState(false);

  const advance = useCallback(() => {
    setActive((current) => {
      const index = AUTH_PERSONAS.findIndex((p) => p.id === current);
      const next = AUTH_PERSONAS[(index + 1) % AUTH_PERSONAS.length];
      return next.id;
    });
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(advance, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [advance, paused]);

  const persona = AUTH_PERSONAS.find((p) => p.id === active) ?? AUTH_PERSONAS[0];

  return (
    <div
      className={`auth-persona${variant === "mobile" ? " auth-persona--mobile" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="auth-persona-eyebrow">Para quem é a TOQ</p>

      <div className="auth-persona-tabs" role="tablist" aria-label="Perfis na plataforma">
        {AUTH_PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active === p.id}
            className={`auth-persona-tab auth-persona-tab--${p.id}${active === p.id ? " is-active" : ""}`}
            onClick={() => setActive(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        key={persona.id}
        className={`auth-persona-panel auth-persona-panel--${persona.id}`}
        role="tabpanel"
      >
        <h3 className="auth-persona-title">{persona.title}</h3>
        <p className="auth-persona-desc">{persona.description}</p>
        <ul className="auth-persona-highlights">
          {persona.highlights.map((item) => (
            <li key={item}>
              <span className="auth-persona-dot" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="auth-persona-progress" aria-hidden>
        {AUTH_PERSONAS.map((p) => (
          <span
            key={p.id}
            className={`auth-persona-progress-bar${active === p.id ? " is-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
