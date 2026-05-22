import Link from "next/link";
import { parseBodySegments } from "@/lib/mentions";
import { profilePath } from "@/lib/publicProfile";

export function PostBody({ body }: { body: string }) {
  const segments = parseBodySegments(body);

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--toq-text)]">
      {segments.map((seg, i) =>
        seg.type === "mention" ? (
          <Link
            key={`${i}-${seg.username}`}
            href={profilePath(seg.username)}
            className="font-semibold text-[var(--toq-sky)] hover:underline"
          >
            @{seg.username}
          </Link>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </p>
  );
}
