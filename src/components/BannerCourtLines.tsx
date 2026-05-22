/**
 * Marcações de quadra em perspectiva (fundo do painel banner), como no material Toq.
 * viewBox 0–100: canto inferior esquerdo = perto; ponto de fuga no topo-centro-direita.
 */
export function BannerCourtLines() {
  const vp: [number, number] = [58, 6];
  const left: [number, number] = [0, 96];
  const right: [number, number] = [54, 94];
  const center: [number, number] = [(left[0] + right[0]) / 2, 95];
  const serviceY = 74;
  const netY = 50;

  function xOnLine(from: [number, number], y: number) {
    const t = (from[1] - y) / (from[1] - vp[1]);
    return from[0] + t * (vp[0] - from[0]);
  }

  const svcLeft = xOnLine(left, serviceY);
  const svcRight = xOnLine(right, serviceY);
  const netLeft = xOnLine(left, netY);
  const netRight = xOnLine(right, netY);

  const meshH: string[] = [];
  const meshV: string[] = [];
  const rows = 10;
  const cols = 8;

  for (let i = 1; i < rows; i++) {
    const y = netY - (i / rows) * (netY - vp[1]);
    const x1 = xOnLine(left, y);
    const x2 = xOnLine(right, y);
    meshH.push(`M${x1} ${y} L${x2} ${y}`);
  }

  for (let i = 1; i < cols; i++) {
    const t = i / cols;
    const x = netLeft + t * (netRight - netLeft);
    const f = 0.55;
    const yTop = netY - f * (netY - vp[1]);
    const xTop = x + f * (vp[0] - x);
    meshV.push(`M${x} ${netY} L${xTop} ${yTop}`);
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      aria-hidden
    >
      <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
        {/* Laterais em perspectiva */}
        <path d={`M${left[0]} ${left[1]} L${vp[0]} ${vp[1]}`} strokeWidth={0.45} opacity={0.22} />
        <path d={`M${right[0]} ${right[1]} L${vp[0]} ${vp[1]}`} strokeWidth={0.45} opacity={0.22} />

        {/* Linha central */}
        <path
          d={`M${center[0]} ${center[1]} L${vp[0]} ${vp[1]}`}
          strokeWidth={0.4}
          opacity={0.2}
        />

        {/* Linha de fundo */}
        <path
          d={`M${left[0]} ${left[1]} L${right[0]} ${right[1]}`}
          strokeWidth={0.55}
          opacity={0.26}
        />

        {/* Linha de saque */}
        <path
          d={`M${svcLeft} ${serviceY} L${svcRight} ${serviceY}`}
          strokeWidth={0.42}
          opacity={0.22}
        />

        {/* Rede */}
        <path
          d={`M${netLeft} ${netY} L${netRight} ${netY}`}
          strokeWidth={0.5}
          opacity={0.24}
        />
        <path d={meshH.join(" ")} strokeWidth={0.28} opacity={0.11} />
        <path d={meshV.join(" ")} strokeWidth={0.28} opacity={0.1} />

        {/* Postes */}
        <path d={`M${netLeft} ${netY} L${netLeft} ${netY + 2.5}`} strokeWidth={0.4} opacity={0.18} />
        <path d={`M${netRight} ${netY} L${netRight} ${netY + 2.5}`} strokeWidth={0.4} opacity={0.18} />
      </g>
    </svg>
  );
}
