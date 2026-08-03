import { AUTH_FAQ } from "./authLandingData";

export function AuthFaqSection() {
  return (
    <div className="auth-faq">
      {AUTH_FAQ.map((item) => (
        <details key={item.id} className="auth-faq-item">
          <summary className="auth-faq-question">
            <span className="auth-faq-ball" aria-hidden>
              🎾
            </span>
            <span className="auth-faq-question-text">{item.question}</span>
          </summary>
          <p className="auth-faq-answer">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
