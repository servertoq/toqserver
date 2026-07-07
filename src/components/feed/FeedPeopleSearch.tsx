"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { profileDisplayName } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";

type SearchResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function FeedPeopleSearch() {
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
      const pattern = `%${q}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .order("username")
        .limit(6);

      setResults((data as SearchResult[]) ?? []);
      setLoading(false);
    }, 250);

    return () => clearTimeout(t);
  }, [query, supabase]);

  return (
    <div className="feed-people-search" ref={wrapRef}>
      <label className="sr-only" htmlFor="feed-people-search-input">
        Buscar pessoas
      </label>
      <span className="feed-people-search-icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" strokeLinecap="round" />
        </svg>
      </span>
      <input
        id="feed-people-search-input"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar pessoas…"
        className="feed-people-search-input"
        aria-expanded={open}
        autoComplete="off"
      />

      {open && query.trim().length >= 2 && (
        <ul className="feed-people-search-results">
          {loading && results.length === 0 ? (
            <li className="feed-people-search-empty">Buscando…</li>
          ) : results.length === 0 ? (
            <li className="feed-people-search-empty">Nenhuma pessoa encontrada</li>
          ) : (
            results.map((r) => {
              const name = profileDisplayName(r);
              return (
                <li key={r.id}>
                  <Link
                    href={profilePath(r.username)}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className="feed-people-search-result"
                  >
                    <SearchAvatar src={r.avatar_url} name={name} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--toq-navy)]">{name}</p>
                      <p className="truncate text-[10px] text-[var(--toq-text-muted)]">@{r.username}</p>
                    </div>
                  </Link>
                </li>
              );
            })
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
