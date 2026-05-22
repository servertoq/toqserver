import type { ReactNode } from "react";

export function BannerOverlay() {
  return (
    <article
      className="absolute inset-0 z-10 flex select-text cursor-text flex-col items-center justify-between px-4 pb-[3%] pt-[6%] text-center font-sans md:px-6 md:pb-[4%] md:pt-[8%]"
      aria-label="Toq Tennis — apresentação"
    >
      <header className="w-full max-w-xs shrink-0">
        <p className="text-sm font-semibold uppercase leading-snug text-white md:text-base lg:text-lg">
          Onde os jogadores
          <br />
          se encontram para
        </p>
        <hr className="mx-auto mt-2 w-12 border-0 border-t-2 border-[#000040]" />
      </header>

      <div className="w-full max-w-md">
        <h1 className="text-[clamp(2.5rem,11vw,5rem)] font-extrabold uppercase leading-none text-white">
          EVOLUIR
        </h1>
      </div>

      <footer className="flex w-full shrink-0 justify-center pb-1 md:pb-3">
        <div className="flex items-stretch justify-center gap-0">
          <FeatureItem
            icon={<IconUsers />}
            label={
              <>
                Jogos do
                <br />
                seu nível
              </>
            }
          />
          <div className="mx-3 w-px self-stretch bg-white/55 md:mx-5" aria-hidden />
          <FeatureItem
            icon={<IconTrophy />}
            label={
              <>
                Mais
                <br />
                parceiros
              </>
            }
          />
          <div className="mx-3 w-px self-stretch bg-white/55 md:mx-5" aria-hidden />
          <FeatureItem
            icon={<IconBolt />}
            label={
              <>
                Mais
                <br />
                partidas
              </>
            }
          />
        </div>
      </footer>
    </article>
  );
}

function FeatureItem({
  icon,
  label,
}: {
  icon: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex min-w-[5.5rem] select-text flex-col items-center justify-center gap-2 px-1 text-center md:min-w-[6.5rem]">
      <div className="pointer-events-none text-white" aria-hidden>
        {icon}
      </div>
      <p className="text-[10px] font-bold uppercase leading-snug text-white md:text-xs lg:text-sm">
        {label}
      </p>
    </div>
  );
}

function IconOutline({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8 md:h-10 md:w-10"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconUsers() {
  return (
    <IconOutline>
      <circle cx="9" cy="7" r="3.25" />
      <path d="M3 20v-.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5V20" />
      <circle cx="17" cy="7" r="3.25" />
      <path d="M14 20v-.5c0-2.5 1.5-4 3.5-4" />
    </IconOutline>
  );
}

function IconTrophy() {
  return (
    <IconOutline>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0V4z" />
      <path d="M5 4H4a2 2 0 0 0 2 2.5" />
      <path d="M19 4h1a2 2 0 0 1-2 2.5" />
    </IconOutline>
  );
}

function IconBolt() {
  return (
    <IconOutline>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </IconOutline>
  );
}
