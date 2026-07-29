"use client";

import Link from "next/link";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
};

export function TermsAcceptCheckbox({ checked, onChange, id = "accept-terms" }: Props) {
  return (
    <label htmlFor={id} className="auth-terms-accept">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="auth-terms-accept__input"
      />
      <span className="auth-terms-accept__text">
        Li e aceito os{" "}
        <Link href="/termos" target="_blank" rel="noopener noreferrer" className="auth-terms-accept__link">
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link
          href="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="auth-terms-accept__link"
        >
          Política de Privacidade
        </Link>
        .
      </span>
    </label>
  );
}
