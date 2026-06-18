import { AUTH_HOW_IT_WORKS } from "./authLandingData";

export function AuthHowItWorks() {
  return (
    <div className="auth-how-steps">
      {AUTH_HOW_IT_WORKS.map((item) => (
        <article key={item.id} className="auth-how-step-card">
          <span className="auth-how-step-num" aria-hidden>
            {item.step}
          </span>
          <h3 className="auth-how-step-title">{item.title}</h3>
          <p className="auth-how-step-desc">{item.description}</p>
        </article>
      ))}
    </div>
  );
}
