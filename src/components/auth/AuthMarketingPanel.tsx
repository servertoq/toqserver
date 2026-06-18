import Image from "next/image";
import { AuthDiscoverContent } from "./AuthDiscoverContent";
import { AUTH_HERO_IMAGE } from "./authLandingData";

export function AuthMarketingPanel() {
  return (
    <aside className="auth-marketing-panel">
      <Image
        src={AUTH_HERO_IMAGE}
        alt=""
        fill
        priority
        sizes="50vw"
        className="auth-marketing-bg object-cover"
        aria-hidden
      />
      <div className="auth-marketing-overlay" aria-hidden />
      <div className="auth-marketing-mesh" aria-hidden />

      <div className="auth-marketing-content">
        <header className="auth-marketing-header">
          <div
            className="auth-marketing-logo"
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
            aria-label="Toq Tennis"
          />
          <span className="auth-marketing-tag">Ecossistema do tênis</span>
        </header>

        <AuthDiscoverContent variant="desktop" showHeadline />
      </div>
    </aside>
  );
}
