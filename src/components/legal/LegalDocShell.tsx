import Link from "next/link";
import { LEGAL_DOCUMENTS, type LegalDocument } from "@/lib/legal/documents";
import { LEGAL_NAV, LEGAL_SITE, type LegalDocId } from "@/lib/legal/site";
import { SiteContactLinks } from "@/components/legal/SiteContactLinks";

type Props = {
  docId: LegalDocId;
};

export function LegalDocShell({ docId }: Props) {
  const doc: LegalDocument = LEGAL_DOCUMENTS[docId];

  return (
    <div className="legal-page">
      <header className="legal-page__top">
        <div className="legal-page__top-inner">
          <Link href="/" className="legal-page__brand" aria-label={LEGAL_SITE.brand}>
            <span
              className="legal-page__logo"
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
              role="img"
              aria-hidden
            />
            <span className="legal-page__brand-text">
              <span className="legal-page__brand-name">{LEGAL_SITE.brand}</span>
              <span className="legal-page__brand-tag">Documentos legais</span>
            </span>
          </Link>
          <Link href="/" className="legal-page__back">
            ← Voltar ao início
          </Link>
        </div>
      </header>

      <div className="legal-page__body">
        <nav className="legal-page__nav" aria-label="Documentos legais">
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={
                item.id === docId
                  ? "legal-page__nav-link legal-page__nav-link--active"
                  : "legal-page__nav-link"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <article className="legal-page__article">
          <p className="legal-page__eyebrow">Documentos legais</p>
          <h1 className="legal-page__title">{doc.title}</h1>
          <p className="legal-page__meta">
            Vigência: {LEGAL_SITE.effectiveDate} · Contato:{" "}
            <a href={`mailto:${LEGAL_SITE.contactEmail}`}>{LEGAL_SITE.contactEmail}</a>
          </p>
          <p className="legal-page__lead">{doc.description}</p>

          {doc.sections.map((section) => (
            <section key={section.heading} className="legal-page__section">
              <h2>{section.heading}</h2>
              {section.paragraphs.map((p, i) => (
                <p key={`${section.heading}-p-${i}`}>{p}</p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul>
                  {section.bullets.map((b, i) => (
                    <li key={`${section.heading}-b-${i}`}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>

      <footer className="legal-page__footer">
        <div className="legal-page__footer-inner">
          <div className="legal-page__footer-brand">
            <Link href="/" className="legal-page__footer-logo-link" aria-label={LEGAL_SITE.brand}>
              <span
                className="legal-page__footer-logo"
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
            <p className="legal-page__footer-meta">
              © {new Date().getFullYear()} {LEGAL_SITE.brand}
            </p>
          </div>

          <nav className="legal-page__footer-docs" aria-label="Outros documentos">
            {LEGAL_NAV.filter((item) => item.id !== docId).map((item) => (
              <Link key={item.id} href={item.href} className="legal-page__footer-doc-link">
                {item.label}
              </Link>
            ))}
          </nav>

          <SiteContactLinks variant="row" className="legal-page__contacts" />
        </div>
      </footer>
    </div>
  );
}
