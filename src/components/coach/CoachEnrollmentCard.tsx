"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateConversation } from "@/lib/messages";
import { profileDisplayName } from "@/lib/profile";
import { profilePath } from "@/lib/publicProfile";
import type { CoachListingEnrollmentWithProfile } from "@/types/coachManagement";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Props = {
  enrollment: CoachListingEnrollmentWithProfile;
  onMoveToStudents: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  showMoveToStudents?: boolean;
};

export function CoachEnrollmentCard({
  enrollment,
  onMoveToStudents,
  onRemove,
  showMoveToStudents = true,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { isSubmitting, guard } = useSingleSubmit();
  const student = enrollment.student;
  const name = profileDisplayName(student);

  async function openChat() {
    await guard(async () => {
      const { id: convId } = await getOrCreateConversation(supabase, student.id);
      if (convId) {
        router.push(`/inicio/mensagens?chat=${convId}`);
      }
    });
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href={profilePath(student.username)}
            className="text-sm font-bold text-[var(--toq-navy)] hover:underline"
          >
            {name}
          </Link>
          <p className="text-xs text-[var(--toq-text-muted)]">@{student.username}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            enrollment.status === "student"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {enrollment.status === "student" ? "Aluno" : "Lead"}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-xs text-[var(--toq-text-muted)]">
        {enrollment.contact_phone && (
          <div>
            <dt className="inline font-semibold text-[var(--toq-navy)]">Telefone: </dt>
            <dd className="inline">
              <a href={`tel:${enrollment.contact_phone}`} className="hover:underline">
                {enrollment.contact_phone}
              </a>
            </dd>
          </div>
        )}
        {enrollment.contact_email && (
          <div>
            <dt className="inline font-semibold text-[var(--toq-navy)]">E-mail: </dt>
            <dd className="inline">
              <a href={`mailto:${enrollment.contact_email}`} className="hover:underline">
                {enrollment.contact_email}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void openChat()}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[var(--toq-navy)] hover:border-[var(--toq-accent)]"
        >
          Chat
        </button>
        {enrollment.contact_phone && (
          <a
            href={`https://wa.me/55${enrollment.contact_phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white"
          >
            WhatsApp
          </a>
        )}
        {showMoveToStudents && enrollment.status === "lead" && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void onMoveToStudents(enrollment.id)}
            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Mover para alunos
          </button>
        )}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void onRemove(enrollment.id)}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          Excluir
        </button>
      </div>
    </article>
  );
}
