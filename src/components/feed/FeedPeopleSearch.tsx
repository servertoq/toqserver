"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { profileDisplayName } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";

type SearchResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  /** Barra no rail do feed (desktop). `mobileHeader` = ícone no topo do app no celular. */
  variant?: "sidebar" | "mobileHeader";
};

function usePeopleSearch() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

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

  function reset() {
    setQuery("");
    setResults([]);
  }

  return { query, setQuery, results, loading, reset };
}

export function FeedPeopleSearch({ variant = "sidebar" }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { query, setQuery, results, loading, reset } = usePeopleSearch();

  useEffect(() => {
    if (variant !== "sidebar") return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [variant]);

  useEffect(() => {
    if (!sheetOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  function closeSheet() {
    setSheetOpen(false);
    reset();
  }

  if (variant === "mobileHeader") {
    return (
      <>
        <button
          type="button"
          className="app-mobile-header-icon-btn"
          aria-label="Buscar pessoas"
          onClick={() => setSheetOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" strokeLinecap="round" />
          </svg>
        </button>

        {sheetOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div className="mobile-people-search-sheet" role="dialog" aria-label="Buscar pessoas">
              <button
                type="button"
                className="mobile-people-search-sheet-backdrop"
                aria-label="Fechar busca"
                onClick={closeSheet}
              />
              <div className="mobile-people-search-sheet-panel">
                <div className="mobile-people-search-sheet-field">
                  <span className="mobile-people-search-sheet-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20l-3-3" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar pessoas…"
                    className="mobile-people-search-sheet-input"
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                  <button
                    type="button"
                    className="mobile-people-search-sheet-cancel"
                    onClick={closeSheet}
                  >
                    Cancelar
                  </button>
                </div>
                <PeopleSearchResults
                  query={query}
                  results={results}
                  loading={loading}
                  listClassName="mobile-people-search-sheet-results"
                  onPick={() => closeSheet()}
                />
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

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
          setDropdownOpen(true);
        }}
        onFocus={() => setDropdownOpen(true)}
        placeholder="Buscar pessoas…"
        className="feed-people-search-input"
        aria-expanded={dropdownOpen}
        autoComplete="off"
      />

      {dropdownOpen && query.trim().length >= 2 && (
        <PeopleSearchResults
          query={query}
          results={results}
          loading={loading}
          listClassName="feed-people-search-results"
          onPick={() => {
            setDropdownOpen(false);
            reset();
          }}
        />
      )}
    </div>
  );
}

function PeopleSearchResults({
  query,
  results,
  loading,
  listClassName,
  onPick,
}: {
  query: string;
  results: SearchResult[];
  loading: boolean;
  listClassName: string;
  onPick: () => void;
}) {
  if (query.trim().length < 2) {
    return (
      <p className="mobile-people-search-sheet-hint px-1 py-3 text-center text-xs text-[var(--toq-text-muted)]">
        Digite pelo menos 2 caracteres para buscar amigos e jogadores.
      </p>
    );
  }

  return (
    <ul className={listClassName}>
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
                onClick={onPick}
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
