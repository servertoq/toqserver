import Image from "next/image";

export function LoginPanelBackground() {
  return (
    <Image
      src="/imagens_publicas/fundotoqdois.png"
      alt=""
      fill
      priority
      sizes="(max-width: 768px) 100vw, 50vw"
      className="auth-split-img auth-split-img--right object-cover"
      aria-hidden
    />
  );
}
