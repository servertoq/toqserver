"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { profileDisplayName } from "@/lib/profile";

type SearchResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  excludeUserIds?: string[];
  disabled?: boolean;
  id?: string;
};

export function UsernameSearchInput({
  value,
  onChange,
  placeholder = "@usuario",
  excludeUserIds = [],
  disabled = false,
  id,
}: Props) {
  const supabase = createClient();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const excluded = new Set(excludeUserIds);

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
    const q = value.trim().replace(/^@/, "");
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const pattern = `%${q}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .order("username")
        .limit(8);

      setResults(
        ((data as SearchResult[]) ?? []).filter((row) => !excluded.has(row.id))
      );
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [value, supabase, excludeUserIds]);

  function pickUser(username: string) {
    onChange(username);
    setOpen(false);
  }

  return (
    <div className="username-search-input relative overflow-visible" ref={wrapRef}>
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
      />

      {open && value.trim().replace(/^@/, "").length >= 2 && (
        <ul className="username-search-results">
          {loading && results.length === 0 ? (
            <li className="username-search-empty">Buscando…</li>
          ) : results.length === 0 ? (
            <li className="username-search-empty">Nenhum jogador encontrado</li>
          ) : (
            results.map((row) => {
              const name = profileDisplayName(row);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickUser(row.username)}
                    className="username-search-result"
                  >
                    <SearchAvatar src={row.avatar_url} name={name} />
                    <div className="min-w-0 text-left">
                      <p className="truncate text-xs font-semibold text-[var(--toq-navy)]">{name}</p>
                      <p className="truncate text-[10px] text-[var(--toq-text-muted)]">@{row.username}</p>
                    </div>
                  </button>
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
