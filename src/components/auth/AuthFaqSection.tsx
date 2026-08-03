import Image from "next/image";
import { AUTH_FAQ } from "./authLandingData";

const BOLA_TENIS = "/imagens_publicas/bola_tenis.png?v=5";

export function AuthFaqSection() {
  return (
    <div className="auth-faq">
      {AUTH_FAQ.map((item) => (
        <details key={item.id} className="auth-faq-item">
          <summary className="auth-faq-question">
            <span className="auth-faq-ball auth-ball-spin auth-ball-frame" aria-hidden>
              <Image
                src={BOLA_TENIS}
                alt=""
                fill
                sizes="20px"
                className="auth-ball-img object-cover"
              />
            </span>
            <span className="auth-faq-question-text">{item.question}</span>
          </summary>
          <p className="auth-faq-answer">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
