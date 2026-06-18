import Image from "next/image";
import { AUTH_HERO_IMAGE } from "./auth/authLandingData";

export function LoginPanelBackground() {
  return (
    <Image
      src={AUTH_HERO_IMAGE}
      alt=""
      fill
      priority
      sizes="(max-width: 768px) 100vw, 50vw"
      className="auth-split-img auth-split-img--right object-cover"
      aria-hidden
    />
  );
}
