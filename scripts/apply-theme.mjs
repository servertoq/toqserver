import fs from "fs";
import path from "path";

function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(f)) acc.push(p);
  }
  return acc;
}

const reps = [
  [/bg-\[var\(--toq-lime-light\)\]([^"\n]*?)text-\[var\(--toq-navy\)\]/g, "toq-btn-primary$1text-white"],
  [/bg-\[var\(--toq-lime-light\)\]/g, "toq-btn-primary"],
  [/text-\[var\(--toq-lime-dark\)\]/g, "text-[var(--toq-accent)]"],
  [/text-\[var\(--toq-lime-light\)\]/g, "text-[var(--toq-accent)]"],
  [/border-\[var\(--toq-lime-light\)\]/g, "border-[var(--toq-accent)]"],
  [/border-2 border-\[var\(--toq-lime-light\)\]/g, "border border-[var(--toq-border)]"],
  [/ring-\[var\(--toq-lime-light\)\]/g, "ring-[var(--toq-accent-soft)]"],
  [/focus:border-\[var\(--toq-lime-light\)\]/g, "focus:border-[var(--toq-accent)]"],
  [/focus:ring-\[var\(--toq-lime-light\)\]/g, "focus:ring-[var(--toq-accent)]"],
  [/hover:bg-\[var\(--toq-lime-bright\)\]/g, "hover:opacity-90"],
  [/hover:bg-\[var\(--toq-lime-light\)\]/g, "hover:bg-[var(--toq-accent-soft)]"],
  [/bg-\[var\(--toq-lime-light\)\]\/10/g, "bg-[var(--toq-accent-soft)]"],
  [/bg-\[var\(--toq-lime-light\)\]\/40/g, "bg-[var(--toq-accent-soft)]"],
  [/#0084ff/g, "var(--toq-accent)"],
  [/bg-\[#0084ff\]/g, "bg-[var(--toq-accent)]"],
  [/from-\[var\(--toq-navy\)\] to-\[var\(--toq-sky\)\]/g, "from-[var(--toq-navy)] to-[var(--toq-accent)]"],
  [/rounded-2xl border border-slate-200 bg-white p-6 shadow-sm/g, "toq-card-lg p-6"],
  [/rounded-2xl border border-slate-200 bg-white shadow-sm/g, "toq-card-lg"],
  [/rounded-2xl border border-slate-200 bg-white p-4/g, "toq-card p-4"],
  [/rounded-2xl border border-slate-200 bg-white p-5/g, "toq-card p-5"],
  [/border-b border-slate-200 bg-white\/95 backdrop-blur-md/g, "toq-topbar backdrop-blur-md"],
  [/border-b border-slate-200 bg-white\/95 backdrop-blur/g, "toq-topbar backdrop-blur-md"],
  [/border border-slate-200 bg-white px-3 py-2/g, "toq-input px-3 py-2"],
  [/rounded-lg border border-slate-200 bg-white px-3 py-2/g, "toq-input px-3 py-2"],
];

let count = 0;
for (const f of walk("src")) {
  let c = fs.readFileSync(f, "utf8");
  const o = c;
  for (const [a, b] of reps) c = c.replace(a, b);
  if (c !== o) {
    fs.writeFileSync(f, c);
    count++;
  }
}
console.log(`updated ${count} files`);
