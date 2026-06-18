import { AuthFeatureGrid } from "./AuthFeatureGrid";
import { AuthPersonaShowcase } from "./AuthPersonaShowcase";

type Props = {
  variant?: "desktop" | "mobile";
  showHeadline?: boolean;
};

export function AuthDiscoverContent({ variant = "desktop", showHeadline = true }: Props) {
  return (
    <div className={`auth-discover-content${variant === "mobile" ? " auth-discover-content--mobile" : ""}`}>
      {showHeadline && (
        <div className="auth-discover-intro">
          <h1 className="auth-discover-headline">
            O tênis merece
            <br />
            <span>uma rede de verdade</span>
          </h1>
          <p className="auth-discover-lead">
            Partidas, aulas, arenas e comunidade — conectados em uma plataforma profissional.
          </p>
        </div>
      )}

      <AuthPersonaShowcase variant={variant} />
      <AuthFeatureGrid compact={variant === "desktop"} />
    </div>
  );
}
