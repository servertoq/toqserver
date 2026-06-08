import fs from "fs";

const f = "src/components/messages/MessagesInbox.tsx";
let c = fs.readFileSync(f, "utf8");

// Popup usa o mesmo tema claro da página
c = c.replace(
  /isPage \? ([^:]+) : ([^}]+)/g,
  (_, light) => light.trim()
);

c = c.replace(
  'messages-popup flex h-[min(520px,75dvh)] flex-col overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-[0_8px_40px_rgba(0,0,0,0.45)]',
  'messages-popup toq-card-lg flex h-[min(520px,75dvh)] flex-col overflow-hidden text-[var(--toq-navy)] shadow-[0_16px_48px_rgba(5,16,36,0.14)]'
);

c = c.replace(/bg-zinc-\d+/g, "bg-white");
c = c.replace(/border-zinc-\d+\/?\d*/g, "border-[var(--toq-border)]");
c = c.replace(/text-zinc-\d+/g, "text-[var(--toq-text-muted)]");
c = c.replace(/hover:bg-zinc-\d+\/?\d*/g, "hover:bg-[var(--toq-accent-soft)]");
c = c.replace(/hover:text-zinc-\d+/g, "hover:text-[var(--toq-navy)]");
c = c.replace(
  'rounded-bl-sm bg-zinc-700 text-zinc-100',
  'rounded-bl-sm border border-[var(--toq-border)] bg-white text-[var(--toq-navy)] shadow-sm'
);
c = c.replace('border-b-2 border-white text-white', 'border-b-2 border-[var(--toq-accent)] text-[var(--toq-navy)]');

fs.writeFileSync(f, c);
console.log("MessagesInbox theme unified");
