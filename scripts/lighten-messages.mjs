import fs from "fs";

const f = "src/components/messages/MessagesInbox.tsx";
let c = fs.readFileSync(f, "utf8");

const pairs = [
  [
    '"messages-popup flex h-[min(520px,75dvh)] flex-col overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-[0_8px_40px_rgba(0,0,0,0.45)]"',
    '"messages-popup toq-card-lg flex h-[min(520px,75dvh)] flex-col overflow-hidden text-[var(--toq-navy)] shadow-[0_16px_48px_rgba(5,16,36,0.14)]"',
  ],
  ['${isPage ? "bg-slate-50" : "bg-zinc-900"}', '"bg-[var(--toq-surface)]"'],
  ['${isPage ? "border-slate-200 bg-white" : "border-zinc-800 bg-zinc-900"}', '"border-[var(--toq-border)] bg-white"'],
  ['${isPage ? "text-[var(--toq-sky)]" : "text-[#0084ff]"}', '"text-[var(--toq-accent)]"'],
  ['${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-500"}', '"text-[var(--toq-text-muted)]"'],
  ['${isPage ? "border-slate-200 bg-white" : "border-zinc-700/80"}', '"border-[var(--toq-border)] bg-white"'],
  ['${isPage ? "border-slate-200 bg-white" : "border-zinc-700/80 bg-zinc-900"}', '"border-[var(--toq-border)] bg-white"'],
  ['className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"', 'className="rounded-lg p-2 text-[var(--toq-text-muted)] hover:bg-[var(--toq-accent-soft)] hover:text-[var(--toq-navy)]"'],
  ['${isPage ? "border-slate-200 bg-slate-50 focus-within:border-[var(--toq-lime-light)] focus-within:bg-white" : "border-zinc-700/80 bg-zinc-800 focus-within:border-zinc-600"}', '"border-[var(--toq-border)] bg-[var(--toq-surface)] focus-within:border-[var(--toq-accent)] focus-within:bg-white"'],
  ['${isPage ? "text-[var(--toq-navy)] placeholder:text-[var(--toq-text-muted)]" : "text-white placeholder:text-zinc-500"}', '"text-[var(--toq-navy)] placeholder:text-[var(--toq-text-muted)]"'],
  ['${isPage ? "text-[var(--toq-text-muted)] hover:bg-slate-200" : "text-zinc-500 hover:bg-zinc-700"}', '"text-[var(--toq-text-muted)] hover:bg-[var(--toq-accent-soft)]"'],
  ['${isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-400"}', '"text-[var(--toq-text-muted)]"'],
  ['${isPage ? "hover:bg-slate-50" : "hover:bg-zinc-800/80"}', '"hover:bg-[var(--toq-accent-soft)]"'],
  ['${isPage ? "text-[var(--toq-navy)]" : "text-zinc-200"}', '"text-[var(--toq-navy)]"'],
  ['bg-[var(--toq-lime-light)]/20', 'bg-[var(--toq-accent-soft)]'],
  ['bg-[#0084ff]', 'bg-[var(--toq-accent)]'],
  [
    '${mine ? (isPage ? "rounded-br-sm bg-[var(--toq-lime-light)] text-[var(--toq-navy)]" : "rounded-br-sm bg-[#0084ff] text-white") : isPage ? "rounded-bl-sm bg-white text-[var(--toq-navy)] shadow-sm" : "rounded-bl-sm bg-zinc-700 text-zinc-100"}',
    '${mine ? "rounded-br-sm toq-btn-primary text-white" : "rounded-bl-sm border border-[var(--toq-border)] bg-white text-[var(--toq-navy)] shadow-sm"}',
  ],
  [
    '${isPage ? "border-slate-200 bg-white" : "border-zinc-800 bg-zinc-900"}',
    '"border-[var(--toq-border)] bg-white"',
  ],
  [
    '${isPage ? "border-slate-200 bg-slate-50 focus-within:border-[var(--toq-lime-light)] focus-within:bg-white" : "border-zinc-700/80 bg-zinc-800 focus-within:border-zinc-600"}',
    '"border-[var(--toq-border)] bg-[var(--toq-surface)] focus-within:border-[var(--toq-accent)] focus-within:bg-white"',
  ],
  [
    '${active ? (isPage ? "border-b-2 border-[var(--toq-lime-light)] text-[var(--toq-navy)]" : "border-b-2 border-white text-white") : isPage ? "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]" : "text-zinc-500 hover:text-zinc-300"}',
    '${active ? "border-b-2 border-[var(--toq-accent)] text-[var(--toq-navy)]" : "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]"}',
  ],
  [
    'unread ? (isPage ? "font-semibold text-[var(--toq-navy)]" : "font-semibold text-zinc-300") : isPage ? "text-[var(--toq-text-muted)]" : "text-zinc-500"',
    'unread ? "font-semibold text-[var(--toq-navy)]" : "text-[var(--toq-text-muted)]"',
  ],
];

for (const [from, to] of pairs) {
  c = c.split(from).join(to);
}

fs.writeFileSync(f, c);
console.log("done");
