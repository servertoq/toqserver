"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { profilePath } from "@/lib/publicProfile";

type SearchResult = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
};

export function SearchBar() {
  const supabase = createClient();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio")
        .ilike("username", `${q}%`)
        .order("username")
        .limit(8);

      setResults((data as SearchResult[]) ?? []);
      setLoading(false);
    }, 250);

    return () => clearTimeout(t);
  }, [query, supabase]);

  return (
    <div className="relative w-full" ref={wrapRef}>
      <span
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--toq-text-muted)]"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-3.5 w-3.5"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar jogadores…"
        className="w-full rounded-full toq-input border-[var(--toq-border)] py-1.5 pl-8 pr-3 text-xs text-[var(--toq-text)] shadow-none outline-none ring-[var(--toq-sky)] focus:ring-2 placeholder:text-[var(--toq-text-muted)]"
        aria-label="Buscar jogadores"
        aria-expanded={open}
        autoComplete="off"
      />

      {open && query.trim().length >= 2 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[var(--toq-border)] bg-[var(--toq-card)] py-1 shadow-lg">
          {loading && results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--toq-text-muted)]">Buscando…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--toq-text-muted)]">Nenhum jogador encontrado</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <Link
                  href={profilePath(r.username)}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--toq-surface)]"
                >
                  <SearchAvatar src={r.avatar_url} name={r.username} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--toq-navy)]">
                      @{r.username}
                    </p>
                    {r.bio && (
                      <p className="truncate text-[10px] text-[var(--toq-text-muted)]">{r.bio}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function SearchAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--toq-sky)] text-xs font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
