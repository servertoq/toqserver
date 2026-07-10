"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UsernameSearchUser = {
  id: string;
  username: string;
  avatar_url: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useProfileSearch(query: string, enabled: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [results, setResults] = useState<UsernameSearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmed = query.trim().replace(/^@/, "");

  useEffect(() => {
    if (!enabled || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("search_profiles_for_mention", {
        p_query: trimmed,
        p_limit: 8,
      });

      if (cancelled) return;
      setResults(error ? [] : ((data as UsernameSearchUser[]) ?? []));
      setLoading(false);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, enabled, supabase]);

  return { results, loading, trimmed };
}

type SearchDropdownProps = {
  show: boolean;
  loading: boolean;
  results: UsernameSearchUser[];
  onPick: (user: UsernameSearchUser) => void;
};

function SearchDropdown({ show, loading, results, onPick }: SearchDropdownProps) {
  if (!show) return null;

  return (
    <ul
      className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--toq-border)] bg-[var(--toq-card)] py-1 shadow-lg"
      role="listbox"
    >
      {loading && results.length === 0 ? (
        <li className="px-3 py-2 text-xs text-[var(--toq-text-muted)]">Buscando…</li>
      ) : results.length === 0 ? (
        <li className="px-3 py-2 text-xs text-[var(--toq-text-muted)]">
          Nenhum usuário encontrado
        </li>
      ) : (
        results.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(user)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--toq-accent-soft)]"
            >
              <UserAvatar src={user.avatar_url} name={user.username} />
              <span className="truncate text-sm font-semibold text-[var(--toq-navy)]">
                @{user.username}
              </span>
            </button>
          </li>
        ))
      )}
    </ul>
  );
}

function UserAvatar({ src, name }: { src: string | null; name: string }) {
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

function SelectedUserChip({
  user,
  showId,
  onClear,
}: {
  user: UsernameSearchUser;
  showId?: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--toq-accent)] bg-[var(--toq-accent-soft)] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <UserAvatar src={user.avatar_url} name={user.username} />
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[var(--toq-navy)]">
            @{user.username}
          </span>
          {showId && (
            <span className="block truncate font-mono text-[10px] text-[var(--toq-text-muted)]">
              {user.id}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-xs font-semibold text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]"
      >
        Trocar
      </button>
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [ref, onClose]);
}

/** Seleção de usuário (banir, adicionar à equipe, etc.) */
export function StaffUsernameSearch({
  value,
  onChange,
  placeholder = "Digite o @usuário…",
  label = "Usuário",
}: {
  value: UsernameSearchUser | null;
  onChange: (user: UsernameSearchUser | null) => void;
  placeholder?: string;
  label?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const searchEnabled = open && !value;
  const { results, loading, trimmed } = useProfileSearch(query, searchEnabled);
  const showMenu = searchEnabled && trimmed.length >= 2;

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapRef, close);

  const pickUser = (user: UsernameSearchUser) => {
    onChange(user);
    setQuery("");
    setOpen(false);
  };

  return (
    <div>
      {label && <label className="text-xs font-semibold text-[var(--toq-navy)]">{label}</label>}
      <div ref={wrapRef} className={`relative w-full overflow-visible ${label ? "mt-1" : ""}`}>
        {value ? (
          <SelectedUserChip user={value} onClear={() => onChange(null)} />
        ) : (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder={placeholder}
              autoComplete="off"
              aria-expanded={showMenu}
              className="toq-input w-full px-3 py-2 text-sm"
            />
            <SearchDropdown
              show={showMenu}
              loading={loading}
              results={results}
              onPick={pickUser}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Campo de UUID com busca por @usuário */
export function StaffResourceIdSearch({
  value,
  onChange,
  placeholder = "@usuário ou UUID do recurso…",
  label = "ID do recurso (UUID)",
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pickedUser, setPickedUser] = useState<UsernameSearchUser | null>(null);

  const isUuid = UUID_RE.test(value.trim());
  const searchEnabled = open && !pickedUser && !isUuid;
  const { results, loading, trimmed } = useProfileSearch(value, searchEnabled);
  const showMenu = searchEnabled && trimmed.length >= 2;

  useEffect(() => {
    if (!value) setPickedUser(null);
  }, [value]);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapRef, close);

  const pickUser = (user: UsernameSearchUser) => {
    setPickedUser(user);
    onChange(user.id);
    setOpen(false);
  };

  return (
    <div>
      {label && <label className="text-xs font-semibold text-[var(--toq-navy)]">{label}</label>}
      <div ref={wrapRef} className={`relative w-full overflow-visible ${label ? "mt-1" : ""}`}>
        {pickedUser ? (
          <SelectedUserChip
            user={pickedUser}
            showId
            onClear={() => {
              setPickedUser(null);
              onChange("");
            }}
          />
        ) : (
          <>
            <input
              type="search"
              value={value}
              onChange={(e) => {
                setPickedUser(null);
                onChange(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder={placeholder}
              autoComplete="off"
              aria-expanded={showMenu}
              className="toq-input w-full px-3 py-2 text-sm"
            />
            <SearchDropdown
              show={showMenu}
              loading={loading}
              results={results}
              onPick={pickUser}
            />
          </>
        )}
      </div>
    </div>
  );
}
