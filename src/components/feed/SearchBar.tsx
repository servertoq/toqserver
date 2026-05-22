export function SearchBar() {
  return (
    <div className="relative w-full max-w-xl">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--toq-text-muted)]"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        readOnly
        placeholder="Procure por clubes, jogadores e eventos!"
        className="w-full cursor-default rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[var(--toq-text)] shadow-sm outline-none placeholder:text-[var(--toq-text-muted)]"
        aria-label="Busca (em breve)"
      />
    </div>
  );
}
