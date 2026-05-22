import Image from "next/image";

const BOLA_TENIS = "/imagens_publicas/bola_tenis.png?v=5";

const balls = [
  {
    className:
      "absolute right-[18%] top-[8%] h-11 w-11 rotate-[40deg] opacity-45 md:h-14 md:w-14",
    size: 56,
  },
] as const;

export function BannerTennisBalls() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {balls.map((ball, i) => (
        <Image
          key={i}
          src={BOLA_TENIS}
          alt=""
          width={ball.size}
          height={ball.size}
          className={ball.className}
          aria-hidden
        />
      ))}
    </div>
  );
}
