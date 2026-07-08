"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Suggestion = { id: string; username: string; avatar_url: string | null };

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  className?: string;
  /** Enter envia o formulário pai (Shift+Enter quebra linha) */
  submitOnEnter?: boolean;
};

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  required,
  className = "",
  submitOnEnter = false,
}: Props) {
  const supabase = createClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (query: string) => {
      setLoading(true);
      const { data } = await supabase.rpc("search_profiles_for_mention", {
        p_query: query,
        p_limit: 8,
      });
      setSuggestions((data as Suggestion[]) ?? []);
      setActiveIndex(0);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    if (mentionQuery === null) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => search(mentionQuery), 200);
    return () => clearTimeout(t);
  }, [mentionQuery, search]);

  function detectMention(text: string, cursor: number) {
    const before = text.slice(0, cursor);
    const match = /(^|[\s])@([a-zA-Z0-9_]*)$/.exec(before);
    if (!match) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(match[2]);
  }

  function insertMention(username: string) {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const match = /(^|[\s])@([a-zA-Z0-9_]*)$/.exec(before);
    if (!match) return;

    const prefix = before.slice(0, match.index! + match[1].length);
    const next = `${prefix}@${username} ${after}`;
    onChange(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = prefix.length + username.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    detectMention(e.target.value, e.target.selectionStart);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const pickingMention =
      mentionQuery !== null && suggestions.length > 0;

    if (e.key === "Enter" && !e.shiftKey) {
      if (pickingMention) {
        e.preventDefault();
        insertMention(suggestions[activeIndex].username);
        return;
      }
      if (submitOnEnter) {
        e.preventDefault();
        (e.currentTarget.closest("form") as HTMLFormElement | null)?.requestSubmit();
        return;
      }
    }

    if (!pickingMention) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Tab") {
      e.preventDefault();
      insertMention(suggestions[activeIndex].username);
    } else if (e.key === "Escape") {
      setMentionQuery(null);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => detectMention(value, e.currentTarget.selectionStart)}
        onKeyUp={(e) => detectMention(value, e.currentTarget.selectionStart)}
        onBlur={() => {
          window.setTimeout(() => setMentionQuery(null), 120);
        }}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className={
          className ||
          "w-full resize-none rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-text)] outline-none focus:border-[var(--toq-accent)] focus:ring-2 focus:ring-[var(--toq-accent-soft)]/20"
        }
      />
      {mentionQuery !== null && (suggestions.length > 0 || loading) && (
        <ul
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-[var(--toq-border)] bg-[var(--toq-card)] py-1 shadow-lg"
          role="listbox"
        >
          {loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--toq-text-muted)]">Buscando…</li>
          ) : (
            suggestions.map((s, i) => (
              <li key={s.id} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--toq-surface)] ${
                    i === activeIndex ? "bg-[var(--toq-surface)]" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(s.username);
                  }}
                >
                  <MentionAvatar src={s.avatar_url} name={s.username} />
                  <span className="font-semibold text-[var(--toq-navy)]">@{s.username}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function MentionAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-6 w-6 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--toq-sky)] text-[10px] font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
