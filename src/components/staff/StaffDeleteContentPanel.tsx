"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteStaffClubCourt,
  deleteStaffComment,
  deleteStaffCommunity,
  deleteStaffCourt,
  deleteStaffPost,
  deleteStaffTournament,
  formatStaffDateTime,
  listStaffUserComments,
  listStaffUserPosts,
  searchStaffClubCourts,
  searchStaffCommunities,
  searchStaffCourts,
  searchStaffTournaments,
  truncateText,
  type StaffClubCourtResult,
  type StaffCommunityResult,
  type StaffCourtResult,
  type StaffTournamentResult,
  type StaffUserComment,
  type StaffUserPost,
} from "@/lib/staffModeration";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StaffUsernameSearch, type UsernameSearchUser } from "./StaffUsernameSearch";

type Props = {
  onAction: () => void;
};

type DeleteTab =
  | "posts"
  | "comments"
  | "community"
  | "court"
  | "club_court"
  | "tournament";

const TABS: { id: DeleteTab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "comments", label: "Comentários" },
  { id: "community", label: "Comunidade" },
  { id: "court", label: "Quadra" },
  { id: "club_court", label: "Quadra clube" },
  { id: "tournament", label: "Torneio" },
];

export function StaffDeleteContentPanel({ onAction }: Props) {
  const [tab, setTab] = useState<DeleteTab>("posts");

  return (
    <div className="mt-6 overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-[var(--toq-navy)]">Exclusão de conteúdo</h2>
      <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
        Posts e comentários: busque o autor, filtre por data e exclua o item. Comunidades,
        quadras e torneios: busque pelo nome.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-[var(--toq-navy)] text-white"
                : "border border-slate-200 text-[var(--toq-navy)] hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "posts" && <StaffUserPostsDelete onAction={onAction} />}
        {tab === "comments" && <StaffUserCommentsDelete onAction={onAction} />}
        {tab === "community" && (
          <StaffNamedResourceDelete
            kind="community"
            label="Buscar comunidade pelo nome"
            placeholder="Nome ou slug da comunidade…"
            onAction={onAction}
          />
        )}
        {tab === "court" && (
          <StaffNamedResourceDelete
            kind="court"
            label="Buscar quadra pelo nome"
            placeholder="Nome da quadra…"
            onAction={onAction}
          />
        )}
        {tab === "club_court" && (
          <StaffNamedResourceDelete
            kind="club_court"
            label="Buscar quadra de clube pelo nome"
            placeholder="Nome da quadra do clube…"
            onAction={onAction}
          />
        )}
        {tab === "tournament" && (
          <StaffNamedResourceDelete
            kind="tournament"
            label="Buscar torneio pelo nome"
            placeholder="Nome do torneio…"
            onAction={onAction}
          />
        )}
      </div>
    </div>
  );
}

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-[var(--toq-text-muted)]">
        De
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="mt-1 block w-full min-w-[140px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs text-[var(--toq-text-muted)]">
        Até
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="mt-1 block w-full min-w-[140px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}

function StaffUserPostsDelete({ onAction }: { onAction: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<UsernameSearchUser | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [posts, setPosts] = useState<StaffUserPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await listStaffUserPosts(supabase, user.id, {
      from: dateFrom,
      to: dateTo,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      setPosts([]);
      return;
    }
    setPosts(data);
  }, [supabase, user, dateFrom, dateTo]);

  useEffect(() => {
    if (!user) {
      setPosts([]);
      return;
    }
    void load();
    // Recarrega só ao trocar o usuário; datas aplicam pelo botão
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleDelete() {
    if (!confirmId) return;
    setDeleting(true);
    const { error: err } = await deleteStaffPost(supabase, confirmId);
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setConfirmId(null);
    await load();
    onAction();
  }

  return (
    <div className="space-y-3">
      <StaffUsernameSearch
        value={user}
        onChange={setUser}
        label="Autor do post"
        placeholder="Buscar @usuário…"
      />
      <DateRangeFilter
        from={dateFrom}
        to={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
      />
      <button
        type="button"
        disabled={!user || loading}
        onClick={() => void load()}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[var(--toq-navy)] hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? "Buscando…" : "Aplicar filtro de data"}
      </button>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {!user ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Selecione um usuário para ver os posts.</p>
      ) : loading ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Carregando posts…</p>
      ) : posts.length === 0 ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Nenhum post encontrado neste período.</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {posts.map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
                    {formatStaffDateTime(post.created_at)}
                    {post.community_name ? ` · ${post.community_name}` : " · Feed geral"}
                  </p>
                  {post.title && (
                    <p className="mt-1 text-sm font-bold text-[var(--toq-navy)]">{post.title}</p>
                  )}
                  <p className="mt-1 text-sm text-[var(--toq-navy)]">
                    {truncateText(post.body)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmId(post.id)}
                  className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmId}
        title="Excluir post"
        message="Esta ação é permanente. O post e comentários associados serão removidos."
        confirmLabel="Excluir post"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

function StaffUserCommentsDelete({ onAction }: { onAction: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<UsernameSearchUser | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [comments, setComments] = useState<StaffUserComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await listStaffUserComments(supabase, user.id, {
      from: dateFrom,
      to: dateTo,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      setComments([]);
      return;
    }
    setComments(data);
  }, [supabase, user, dateFrom, dateTo]);

  useEffect(() => {
    if (!user) {
      setComments([]);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleDelete() {
    if (!confirmId) return;
    setDeleting(true);
    const { error: err } = await deleteStaffComment(supabase, confirmId);
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setConfirmId(null);
    await load();
    onAction();
  }

  return (
    <div className="space-y-3">
      <StaffUsernameSearch
        value={user}
        onChange={setUser}
        label="Autor do comentário"
        placeholder="Buscar @usuário…"
      />
      <DateRangeFilter
        from={dateFrom}
        to={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
      />
      <button
        type="button"
        disabled={!user || loading}
        onClick={() => void load()}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[var(--toq-navy)] hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? "Buscando…" : "Aplicar filtro de data"}
      </button>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {!user ? (
        <p className="text-xs text-[var(--toq-text-muted)]">
          Selecione um usuário para ver os comentários.
        </p>
      ) : loading ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[var(--toq-text-muted)]">
          Nenhum comentário encontrado neste período.
        </p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
                    {formatStaffDateTime(comment.created_at)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--toq-navy)]">
                    {truncateText(comment.body)}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
                    No post: {truncateText(comment.post_body_preview, 80)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmId(comment.id)}
                  className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmId}
        title="Excluir comentário"
        message="Esta ação é permanente. O comentário será removido do post."
        confirmLabel="Excluir comentário"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

type NamedKind = "community" | "court" | "club_court" | "tournament";

type NamedItem =
  | StaffCommunityResult
  | StaffCourtResult
  | StaffClubCourtResult
  | StaffTournamentResult;

function StaffNamedResourceDelete({
  kind,
  label,
  placeholder,
  onAction,
}: {
  kind: NamedKind;
  label: string;
  placeholder: string;
  onAction: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NamedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<NamedItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);

      const searchFn = {
        community: searchStaffCommunities,
        court: searchStaffCourts,
        club_court: searchStaffClubCourts,
        tournament: searchStaffTournaments,
      }[kind];

      const { data, error: err } = await searchFn(supabase, q);
      if (cancelled) return;
      setLoading(false);
      if (err) {
        setError(err.message);
        setResults([]);
        return;
      }
      setResults(data);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, kind, supabase]);

  async function handleDelete() {
    if (!confirmItem) return;
    setDeleting(true);

    const deleteFn = {
      community: () => deleteStaffCommunity(supabase, confirmItem.id),
      court: () => deleteStaffCourt(supabase, confirmItem.id),
      club_court: () => deleteStaffClubCourt(supabase, confirmItem.id),
      tournament: () => deleteStaffTournament(supabase, confirmItem.id),
    }[kind];

    const { error: err } = await deleteFn();
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setConfirmItem(null);
    setResults((prev) => prev.filter((r) => r.id !== confirmItem.id));
    onAction();
  }

  function renderMeta(item: NamedItem) {
    if (kind === "community") {
      const c = item as StaffCommunityResult;
      return `@${c.slug} · ${c.member_count} membros · ${formatStaffDateTime(c.created_at)}`;
    }
    if (kind === "court") {
      const c = item as StaffCourtResult;
      return `${c.city}/${c.state} · @${c.owner_username} · ${formatStaffDateTime(c.created_at)}`;
    }
    const clubItem = item as StaffClubCourtResult | StaffTournamentResult;
    return `${clubItem.community_name} (@${clubItem.community_slug}) · ${formatStaffDateTime(clubItem.created_at)}`;
  }

  const confirmLabels: Record<NamedKind, string> = {
    community: "Excluir comunidade",
    court: "Excluir quadra",
    club_court: "Excluir quadra do clube",
    tournament: "Excluir torneio",
  };

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-[var(--toq-navy)]">{label}</label>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {query.trim().length < 2 ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Digite pelo menos 2 caracteres.</p>
      ) : loading ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Buscando…</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-[var(--toq-text-muted)]">Nenhum resultado encontrado.</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {results.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--toq-navy)]">{item.name}</p>
                <p className="mt-0.5 text-[11px] text-[var(--toq-text-muted)]">{renderMeta(item)}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmItem(item)}
                className="shrink-0 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white"
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmItem}
        title={confirmLabels[kind]}
        message={
          confirmItem
            ? `Excluir permanentemente "${confirmItem.name}"? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel={confirmLabels[kind]}
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmItem(null)}
      />
    </div>
  );
}
