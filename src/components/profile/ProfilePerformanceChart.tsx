type Point = { label: string; value: number };

type Props = {
  data: Point[];
  title?: string;
};

export function ProfilePerformanceChart({ data, title = "Evolução de atividade" }: Props) {
  const width = 100;
  const height = 48;
  const padding = 4;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * innerW;
    const y = padding + innerH - (d.value / 100) * innerH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="profile-chart-card rounded-2xl border border-[var(--toq-profile-border)] bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--toq-profile-muted)]">
        {title}
      </p>
      <div className="mt-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-36 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id="profileChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--toq-profile-accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--toq-profile-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = padding + innerH - (pct / 100) * innerH;
            return (
              <line
                key={pct}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="var(--toq-profile-border)"
                strokeWidth="0.3"
                strokeDasharray="1 1"
              />
            );
          })}
          <path d={areaPath} fill="url(#profileChartFill)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--toq-profile-accent)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p) => (
            <circle
              key={p.label}
              cx={p.x}
              cy={p.y}
              r="1.8"
              fill="white"
              stroke="var(--toq-profile-accent)"
              strokeWidth="0.8"
            />
          ))}
        </svg>
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-profile-muted)]">
          {data.map((d) => (
            <span key={d.label}>{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
