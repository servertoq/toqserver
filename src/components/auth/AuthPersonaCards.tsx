import { AUTH_PERSONAS } from "./authLandingData";

export function AuthPersonaCards() {
  return (
    <div className="auth-persona-cards">
      {AUTH_PERSONAS.map((persona) => (
        <article key={persona.id} className={`auth-persona-card auth-persona-card--${persona.id}`}>
          <p className="auth-persona-card-label">{persona.label}</p>
          <h3 className="auth-persona-card-title">{persona.title}</h3>
          <p className="auth-persona-card-desc">{persona.description}</p>
          <ul className="auth-persona-card-list">
            {persona.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
