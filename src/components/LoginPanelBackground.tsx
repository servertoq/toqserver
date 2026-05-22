import Image from "next/image";

export function LoginPanelBackground() {
  return (
    <Image
      src="/imagens_publicas/fundo_raquete.jpg?v=2"
      alt=""
      fill
      priority
      sizes="(max-width: 768px) 100vw, 50vw"
      className="object-cover object-center"
      aria-hidden
    />
  );
}
