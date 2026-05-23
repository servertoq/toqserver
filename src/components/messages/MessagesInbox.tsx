"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppProfile } from "@/components/app/AppShell";
import { createClient } from "@/lib/supabase/client";
import {
  deleteConversation,
  fetchConversations,
  fetchMessages,
  findProfileByUsername,
  formatMessageTime,
  getOrCreateConversation,
  markConversationRead,
  searchProfilesForMessages,
  sendMessage,
  type MessageSearchProfile,
} from "@/lib/messages";
import { profilePath } from "@/lib/publicProfile";
import type { DmConversation, DmMessage, MessagesTab } from "@/types/messages";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

export type MessagesInboxProps = {
  variant: "popup" | "page";
  onClose?: () => void;
  initialUsername?: string | null;
  initialConversationId?: string | null;
  onConversationsChange?: (list: DmConversation[]) => void;
  onInitialUsernameHandled?: () => void;
};

export function MessagesInbox(props: MessagesInboxProps) {
  const {
    variant,
    onClose,
    initialUsername,
    initialConversationId,
    onConversationsChange,
    onInitialUsernameHandled,
  } = props;
  const isPage = variant === "page";
  const supabase = createClient();
  const profile = useAppProfile();
  const router = useRouter();

  const [view, setView] = useState<"list" | "chat">("list");
  const [tab, setTab] = useState<MessagesTab>("friends");
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const { isSubmitting: sending, guard: guardSend } = useSingleSubmit();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageSearchProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const handledInitial = useRef(false);
  const prevMessageCountRef = useRef(0);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const filtered = useMemo(
    () => conversations.filter((c) => (tab === "friends" ? c.is_friend : !c.is_friend)),
    [conversations, tab]
  );

  const normalizedSearch = searchQuery.trim().replace(/^@/, "").toLowerCase();
  const isSearching = normalizedSearch.length > 0;

  const searchConversations = useMemo(() => {
    if (!isSearching) return filtered;
    return conversations.filter((c) => c.other_user.username.toLowerCase().includes(normalizedSearch));
  }, [conversations, filtered, isSearching, normalizedSearch]);

  const matchingConversationUserIds = useMemo(
    () => new Set(searchConversations.map((c) => c.other_user.id)),
    [searchConversations]
  );

  const peopleResults = useMemo(
    () => searchResults.filter((p) => !matchingConversationUserIds.has(p.id)),
    [matchingConversationUserIds, searchResults]
  );

  const friendsCount = conversations.filter((c) => c.is_friend).length;
  const pendingCount = conversations.filter((c) => !c.is_friend).length;
  const listUnread = conversations.filter((c) => c.is_unread).length;

  const patchConversationRead = useCallback(
    (conversationId: string) => {
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === conversationId ? { ...c, is_unread: false } : c));
        onConversationsChange?.(next);
        return next;
      });
    },
    [onConversationsChange]
  );

  const loadList = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoadingList(true);
      const list = await fetchConversations(supabase, profile.id);
      setConversations(list);
      onConversationsChange?.(list);
      if (!options?.silent) setLoadingList(false);
      return list;
    },
    [onConversationsChange, profile.id, supabase]
  );

  const refreshMessages = useCallback(
    async (conversationId: string) => {
      const msgs = await fetchMessages(supabase, conversationId);
      setMessages(msgs);
      await markConversationRead(supabase, conversationId);
      patchConversationRead(conversationId);
      await loadList({ silent: true });
    },
    [loadList, patchConversationRead, supabase]
  );

  const openConversation = useCallback(
    async (conversationId: string, preferredTab?: MessagesTab) => {
      const switching = activeId !== conversationId;
      setActiveId(conversationId);
      if (!isPage) setView("chat");
      if (switching || messages.length === 0) {
        setLoadingChat(true);
      }
      setError(null);

      if (isPage) {
        router.replace(`/inicio/mensagens?c=${conversationId}`, { scroll: false });
      }

      const list = conversations.length ? conversations : await loadList();
      const conv = list.find((c) => c.id === conversationId);
      if (conv) setTab(preferredTab ?? (conv.is_friend ? "friends" : "pending"));

      const msgs = await fetchMessages(supabase, conversationId);
      setMessages(msgs);
      patchConversationRead(conversationId);
      await markConversationRead(supabase, conversationId);
      await loadList({ silent: true });
      setLoadingChat(false);
    },
    [activeId, conversations, isPage, loadList, messages.length, patchConversationRead, router, supabase]
  );

  const openWithUsername = useCallback(
    async (username: string) => {
      setError(null);
      const other = await findProfileByUsername(supabase, username);
      if (!other) {
        setError(`Usuário @${username} não encontrado.`);
        setView("list");
        return;
      }
      if (other.id === profile.id) return;

      const { id, error: createErr } = await getOrCreateConversation(supabase, other.id);
      if (createErr || !id) {
        setError(createErr ?? "Não foi possível abrir a conversa.");
        return;
      }

      const list = await loadList();
      const conv = list.find((c) => c.id === id);
      await openConversation(id, conv?.is_friend ? "friends" : "pending");
    },
    [loadList, openConversation, profile.id, supabase]
  );

  useEffect(() => {
    void loadList();
    // Lista inicial — não reexecutar quando loadList mudar de identidade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (normalizedSearch.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      const results = await searchProfilesForMessages(supabase, normalizedSearch, profile.id);
      setSearchResults(results);
      setSearching(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [normalizedSearch, profile.id, supabase]);

  useEffect(() => {
    if (handledInitial.current) return;
    if (initialConversationId) {
      handledInitial.current = true;
      void openConversation(initialConversationId);
      return;
    }
    if (initialUsername) {
      handledInitial.current = true;
      void openWithUsername(initialUsername).then(() => onInitialUsernameHandled?.());
    }
  }, [initialConversationId, initialUsername, onInitialUsernameHandled, openConversation, openWithUsername]);

  useEffect(() => {
    if (!activeId) return;
    const interval = window.setInterval(() => {
      void refreshMessages(activeId);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [activeId, refreshMessages]);

  useEffect(() => {
    const grew = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (grew) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  async function handleSelectUser(username: string) {
    setSearchQuery("");
    setSearchResults([]);
    await openWithUsername(username);
  }

  async function handleSelectConversation(id: string) {
    setSearchQuery("");
    setSearchResults([]);
    await openConversation(id);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !draft.trim() || sending) return;

    const text = draft.trim();
    await guardSend(async () => {
      setError(null);
      const { error: sendErr } = await sendMessage(supabase, activeId, profile.id, text);
      if (sendErr) {
        setError(sendErr);
        return;
      }
      setDraft("");
      setMessages(await fetchMessages(supabase, activeId));
      await loadList({ silent: true });
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function handleDelete() {
    if (!activeId || deleting) return;
    const name = activeConversation?.other_user.username ?? "esta conversa";
    if (!window.confirm(`Excluir a conversa com @${name}? Todas as mensagens serão removidas.`)) return;

    setDeleting(true);
    setError(null);
    const { error: deleteErr } = await deleteConversation(supabase, activeId);
    if (deleteErr) {
      setError(deleteErr);
      setDeleting(false);
      return;
    }
    setActiveId(null);
    setMessages([]);
    setView("list");
    if (isPage) router.replace("/inicio/mensagens", { scroll: false });
    await loadList();
    setDeleting(false);
  }

  function handleExpand() {
    onClose?.();
    router.push(
      activeId ? `/inicio/mensagens?c=${encodeURIComponent(activeId)}` : "/inicio/mensagens"
    );
  }

  function handleBackToList() {
    if (isPage) {
      setActiveId(null);
      router.replace("/inicio/mensagens", { scroll: false });
      return;
    }
    setView("list");
  }

  const popupList = !isPage && view === "list";
  const popupChat = !isPage && view === "chat";

  return (
    <div
      className={
        isPage
          ? "flex h-[calc(100dvh-4.5rem)] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:h-[calc(100dvh-2rem)] md:flex-row"
          : "messages-popup flex h-[min(520px,75dvh)] flex-col overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
      }
    >
      {(isPage || popupList) && (
        <aside
          className={
            isPage
              ? `flex w-full shrink-0 flex-col border-r border-slate-200 md:w-[340px] ${activeId ? "hidden md:flex" : "flex flex-1 md:flex-none"}`
              : "flex min-h-0 flex-1 flex-col"
          }
        >
          <InboxHeader
            isPage={isPage}
            listUnread={listUnread}
            onClose={onClose}
            onExpand={!isPage ? handleExpand : undefined}
          />
          <InboxSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            isPage={isPage}
          />
          {!isSearching && (
            <InboxTabs tab={tab} setTab={setTab} friendsCount={friendsCount} pendingCount={pendingCount} isPage={isPage} />
          )}
          {isSearching ? (
            <InboxSearchResults
              loading={loadingList}
              searching={searching}
              query={normalizedSearch}
              conversations={searchConversations}
              people={peopleResults}
              profileId={profile.id}
              isPage={isPage}
              activeId={activeId}
              onSelectConversation={(id) => void handleSelectConversation(id)}
              onSelectUser={(username) => void handleSelectUser(username)}
            />
          ) : (
            <ConversationList
              loading={loadingList}
              items={filtered}
              tab={tab}
              profileId={profile.id}
              isPage={isPage}
              activeId={activeId}
              onSelect={(id) => void openConversation(id)}
            />
          )}
        </aside>
      )}

      {(isPage || popupChat) && (
        <section
          className={`min-w-0 flex-1 flex-col bg-slate-50 ${isPage && !activeId ? "hidden md:flex" : popupChat || (isPage && activeId) ? "flex" : "hidden md:flex"}`}
        >
          {isPage && !activeId ? (
            <EmptyChatState />
          ) : activeId ? (
            <>
              <ChatHeaderBar
                isPage={isPage}
                conversation={activeConversation}
                onBack={handleBackToList}
                onDelete={handleDelete}
                deleting={deleting}
                showDelete={isPage}
                onClose={onClose}
                onExpand={!isPage ? handleExpand : undefined}
              />
              {activeConversation && (
                <div className={`shrink-0 border-b px-4 py-2 ${isPage ? "border-slate-200 bg-white" : "border-zinc-800 bg-zinc-900"}`}>
                  <Link href={profilePath(activeConversation.other_user.username)} className={`text-xs font-semibold hover:underline ${isPage ? "text-[var(--toq-sky)]" : "text-[#0084ff]"}`}>
                    Ver perfil
                  </Link>
                  {!activeConversation.is_friend && (
                    <p className={`text-[11px] ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-500"}`}>
                      Pendente — ao virarem amigos, a conversa vai para Amigos.
                    </p>
                  )}
                </div>
              )}
              <MessageThread scrollRef={scrollRef} loading={loadingChat} messages={messages} profileId={profile.id} isPage={isPage} />
              <MessageComposer draft={draft} setDraft={setDraft} onSubmit={handleSend} sending={sending} isPage={isPage} />
            </>
          ) : null}
        </section>
      )}

      {error && (
        <p className={`shrink-0 border-t px-4 py-2 text-xs ${isPage ? "border-red-200 bg-red-50 text-red-600" : "border-red-900/50 bg-red-950/50 text-red-300"}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function InboxHeader({
  isPage,
  listUnread,
  onClose,
  onExpand,
}: {
  isPage: boolean;
  listUnread: number;
  onClose?: () => void;
  onExpand?: () => void;
}) {
  return (
    <div className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${isPage ? "border-slate-200 bg-white" : "border-zinc-700/80"}`}>
      <div className="flex items-center gap-2">
        <h2 className={`text-xl font-bold ${isPage ? "text-[var(--toq-navy)]" : ""}`}>Mensagens</h2>
        {listUnread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
            {listUnread > 9 ? "9+" : listUnread}
          </span>
        )}
      </div>
      {!isPage && (
        <div className="flex items-center gap-1">
          {onExpand && (
            <button type="button" onClick={onExpand} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Expandir mensagens">
              <ExpandIcon />
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Fechar">
              <CloseIcon />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ChatHeaderBar({
  isPage,
  conversation,
  onBack,
  onDelete,
  deleting,
  showDelete,
  onClose,
  onExpand,
}: {
  isPage: boolean;
  conversation: DmConversation | null;
  onBack: () => void;
  onDelete: () => void;
  deleting: boolean;
  showDelete: boolean;
  onClose?: () => void;
  onExpand?: () => void;
}) {
  return (
    <div className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${isPage ? "border-slate-200 bg-white" : "border-zinc-700/80 bg-zinc-900"}`}>
      <button type="button" onClick={onBack} className="flex min-w-0 items-center gap-2 text-left">
        <span className={`text-xl leading-none md:hidden ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>‹</span>
        {conversation && (
          <>
            <ChatAvatar src={conversation.other_user.avatar_url} name={conversation.other_user.username} size="md" />
            <span className="min-w-0">
              <span className={`block truncate text-sm font-semibold ${isPage ? "text-[var(--toq-navy)]" : ""}`}>{conversation.other_user.username}</span>
              <span className={`block text-[11px] ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>{conversation.is_friend ? "Amigo" : "Pendente"}</span>
            </span>
          </>
        )}
      </button>
      <div className="flex items-center gap-1">
        {showDelete && conversation && (
          <button type="button" onClick={onDelete} disabled={deleting} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        )}
        {!isPage && onExpand && (
          <button type="button" onClick={onExpand} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Expandir mensagens">
            <ExpandIcon />
          </button>
        )}
        {!isPage && onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Fechar">
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function InboxTabs({
  tab,
  setTab,
  friendsCount,
  pendingCount,
  isPage,
}: {
  tab: MessagesTab;
  setTab: (t: MessagesTab) => void;
  friendsCount: number;
  pendingCount: number;
  isPage: boolean;
}) {
  return (
    <div className={`flex shrink-0 border-b px-2 ${isPage ? "border-slate-200 bg-white" : "border-zinc-700/80"}`}>
      <TabButton active={tab === "friends"} onClick={() => setTab("friends")} label="Amigos" count={friendsCount} isPage={isPage} />
      <TabButton active={tab === "pending"} onClick={() => setTab("pending")} label="Pendentes" count={pendingCount} isPage={isPage} />
    </div>
  );
}

function InboxSearchBar({
  value,
  onChange,
  isPage,
}: {
  value: string;
  onChange: (value: string) => void;
  isPage: boolean;
}) {
  return (
    <div className={`shrink-0 border-b px-3 py-2.5 ${isPage ? "border-slate-200 bg-white" : "border-zinc-700/80"}`}>
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 transition ${isPage ? "border-slate-200 bg-slate-50 focus-within:border-[var(--toq-lime-light)] focus-within:bg-white" : "border-zinc-700/80 bg-zinc-800 focus-within:border-zinc-600"}`}
      >
        <SearchIcon className={isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-500"} />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar conversas ou jogadores…"
          aria-label="Buscar conversas ou jogadores"
          autoComplete="off"
          className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm leading-normal shadow-none outline-none ring-0 focus:ring-0 ${isPage ? "text-[var(--toq-navy)] placeholder:text-[var(--toq-text-muted)]" : "text-white placeholder:text-zinc-500"}`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className={`rounded-full p-0.5 ${isPage ? "text-[var(--toq-text-muted)] hover:bg-slate-200" : "text-zinc-500 hover:bg-zinc-700"}`}
            aria-label="Limpar busca"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function InboxSearchResults({
  loading,
  searching,
  query,
  conversations,
  people,
  profileId,
  isPage,
  activeId,
  onSelectConversation,
  onSelectUser,
}: {
  loading: boolean;
  searching: boolean;
  query: string;
  conversations: DmConversation[];
  people: MessageSearchProfile[];
  profileId: string;
  isPage: boolean;
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onSelectUser: (username: string) => void;
}) {
  const hasConversations = conversations.length > 0;
  const hasPeople = people.length > 0;
  const showPeopleLoading = searching && query.length >= 2 && !hasPeople;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading && !hasConversations && !hasPeople && !showPeopleLoading ? (
        <p className={`px-4 py-8 text-center text-sm ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>Carregando…</p>
      ) : !hasConversations && !hasPeople && !showPeopleLoading ? (
        <p className={`px-4 py-8 text-center text-sm ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>
          Nenhum resultado para &ldquo;{query}&rdquo;
        </p>
      ) : (
        <>
          {hasConversations && (
            <section>
              <p className={`px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-500"}`}>
                Conversas
              </p>
              <ul>
                {conversations.map((conv) => (
                  <ConversationListItem
                    key={conv.id}
                    conv={conv}
                    profileId={profileId}
                    isPage={isPage}
                    selected={isPage && activeId === conv.id}
                    onSelect={() => onSelectConversation(conv.id)}
                  />
                ))}
              </ul>
            </section>
          )}

          {(hasPeople || showPeopleLoading) && (
            <section>
              <p className={`px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-500"}`}>
                Jogadores
              </p>
              {showPeopleLoading ? (
                <p className={`px-4 py-4 text-sm ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>Buscando…</p>
              ) : (
                <ul>
                  {people.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => onSelectUser(person.username)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${isPage ? "hover:bg-slate-50" : "hover:bg-zinc-800/80"}`}
                      >
                        <ChatAvatar src={person.avatar_url} name={person.username} size="lg" />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[15px] font-semibold ${isPage ? "text-[var(--toq-navy)]" : "text-zinc-200"}`}>
                            {person.username}
                          </span>
                          <span className={`mt-0.5 block truncate text-[13px] ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-500"}`}>
                            Iniciar conversa
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ConversationListItem({
  conv,
  profileId,
  isPage,
  selected,
  onSelect,
}: {
  conv: DmConversation;
  profileId: string;
  isPage: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const unread = conv.is_unread;
  const preview = conv.last_message
    ? conv.last_message.sender_id === profileId
      ? `Você: ${conv.last_message.body}`
      : conv.last_message.body
    : "Inicie a conversa";

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${selected ? "bg-[var(--toq-lime-light)]/20" : isPage ? "hover:bg-slate-50" : "hover:bg-zinc-800/80"}`}
      >
        <ChatAvatar src={conv.other_user.avatar_url} name={conv.other_user.username} size="lg" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] ${unread ? "font-bold" : isPage ? "font-normal text-[var(--toq-navy)]" : "font-normal text-zinc-200"}`}>
            {conv.other_user.username}
          </span>
          <span className={`mt-0.5 block truncate text-[13px] ${unread ? (isPage ? "font-semibold text-[var(--toq-navy)]" : "font-semibold text-zinc-300") : isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-500"}`}>
            {preview}
            {conv.last_message ? ` · ${formatMessageTime(conv.last_message.created_at)}` : ""}
          </span>
        </span>
        {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#0084ff]" />}
      </button>
    </li>
  );
}

function ConversationList({
  loading,
  items,
  tab,
  profileId,
  isPage,
  activeId,
  onSelect,
}: {
  loading: boolean;
  items: DmConversation[];
  tab: MessagesTab;
  profileId: string;
  isPage: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading && items.length === 0 ? (
        <p className={`px-4 py-8 text-center text-sm ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>Carregando…</p>
      ) : items.length === 0 ? (
        <p className={`px-4 py-8 text-center text-sm ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>
          {tab === "friends" ? "Nenhuma conversa com amigos." : "Nenhuma conversa pendente."}
        </p>
      ) : (
        <ul>
          {items.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conv={conv}
              profileId={profileId}
              isPage={isPage}
              selected={isPage && activeId === conv.id}
              onSelect={() => onSelect(conv.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyChatState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <span className="text-4xl">💬</span>
      <p className="text-sm font-semibold text-[var(--toq-navy)]">Suas mensagens</p>
      <p className="text-xs text-[var(--toq-text-muted)]">Selecione uma conversa ao lado ou inicie pelo perfil de um jogador.</p>
    </div>
  );
}

function MessageThread({
  scrollRef,
  loading,
  messages,
  profileId,
  isPage,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  messages: DmMessage[];
  profileId: string;
  isPage: boolean;
}) {
  return (
    <div ref={scrollRef} className={`min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 ${isPage ? "bg-slate-50" : ""}`}>
      {loading && messages.length === 0 ? (
        <p className={`text-center text-sm ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>Carregando…</p>
      ) : messages.length === 0 ? (
        <p className={`text-center text-sm ${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}`}>Envie a primeira mensagem 🎾</p>
      ) : (
        messages.map((msg) => {
          const mine = msg.sender_id === profileId;
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed md:max-w-[65%] ${mine ? (isPage ? "rounded-br-sm bg-[var(--toq-lime-light)] text-[var(--toq-navy)]" : "rounded-br-sm bg-[#0084ff] text-white") : isPage ? "rounded-bl-sm bg-white text-[var(--toq-navy)] shadow-sm" : "rounded-bl-sm bg-zinc-700 text-zinc-100"}`}>
                {msg.body}
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}

function MessageComposer({
  draft,
  setDraft,
  onSubmit,
  sending,
  isPage,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  sending: boolean;
  isPage: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className={`shrink-0 border-t px-3 py-3 ${isPage ? "border-slate-200 bg-white" : "border-zinc-800"}`}>
      <div className={`flex items-center gap-2 rounded-full border px-3 py-2 transition ${isPage ? "border-slate-200 bg-slate-50 focus-within:border-[var(--toq-lime-light)] focus-within:bg-white" : "border-zinc-700/80 bg-zinc-800 focus-within:border-zinc-600"}`}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Mensagem…"
          maxLength={4000}
          className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] leading-normal shadow-none outline-none ring-0 focus:ring-0 ${isPage ? "text-[var(--toq-navy)] placeholder:text-[var(--toq-text-muted)]" : "text-white placeholder:text-zinc-500"}`}
        />
        <button type="submit" disabled={sending || !draft.trim()} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${isPage ? "text-[var(--toq-lime-dark)]" : "text-[#0084ff] hover:bg-zinc-700/60"}`} aria-label="Enviar">
          <SendIcon />
        </button>
      </div>
    </form>
  );
}

function TabButton({ active, onClick, label, count, isPage }: { active: boolean; onClick: () => void; label: string; count: number; isPage: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-semibold transition ${active ? (isPage ? "border-b-2 border-[var(--toq-lime-light)] text-[var(--toq-navy)]" : "border-b-2 border-white text-white") : isPage ? "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]" : "text-zinc-500 hover:text-zinc-300"}`}
    >
      {label}
      {count > 0 ? ` (${count})` : ""}
    </button>
  );
}

function ChatAvatar({ src, name, size = "md" }: { src: string | null; name: string; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14 text-base" : "h-9 w-9 text-xs";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`${dim} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-[var(--toq-sky)] font-bold text-white`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 shrink-0 ${className ?? ""}`} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M3.4 20.4l17.45-7.6a1 1 0 000-1.8L3.4 3.6a1 1 0 00-1.3 1.3L4.7 11 2.1 19.1a1 1 0 001.3 1.3z" />
    </svg>
  );
}
