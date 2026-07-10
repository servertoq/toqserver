"use client";

import { COACH_LESSON_FORMAT_LABELS } from "@/types/coachManagement";
import type { CoachScheduledLesson } from "@/types/coachManagement";
import { formatLessonSchedule } from "@/lib/coachManagement";
import { profileDisplayName } from "@/lib/profile";

type Props = {
  lesson: CoachScheduledLesson;
  onComplete: (lesson: CoachScheduledLesson) => void;
};

export function CoachLessonCard({ lesson, onComplete }: Props) {
  const isCompleted = lesson.status === "completed";
  const attendees = lesson.attendees ?? [];
  const presentCount = attendees.filter((a) => a.attended === true).length;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-[var(--toq-navy)]">{lesson.theme}</h3>
          <p className="mt-1 text-sm text-[var(--toq-text-muted)]">
            {formatLessonSchedule(lesson)} · {lesson.duration_minutes} min ·{" "}
            {COACH_LESSON_FORMAT_LABELS[lesson.lesson_format]}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
            isCompleted ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-800"
          }`}
        >
          {isCompleted ? "Concluída" : "Agendada"}
        </span>
      </div>

      {lesson.location_detail && (
        <p className="mt-2 text-xs text-[var(--toq-text-muted)]">{lesson.location_detail}</p>
      )}

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
          Convidados ({attendees.length})
        </p>
        {attendees.length === 0 ? (
          <p className="mt-1 text-xs text-[var(--toq-text-muted)]">Nenhum aluno convidado.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {attendees.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--toq-navy)]">
                  {profileDisplayName(a.student)}{" "}
                  <span className="text-[var(--toq-text-muted)]">@{a.student.username}</span>
                </span>
                {isCompleted && (
                  <span
                    className={`font-bold ${a.attended ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {a.attended ? "Presente" : "Faltou"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isCompleted && lesson.session_report && (
        <div className="mt-3 rounded-xl border border-slate-200 px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--toq-text-muted)]">
            Relatório
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-navy)]">
            {lesson.session_report}
          </p>
          {lesson.completed_at && (
            <p className="mt-2 text-[11px] text-[var(--toq-text-muted)]">
              Concluída em{" "}
              {new Date(lesson.completed_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {attendees.length > 0 && ` · ${presentCount}/${attendees.length} presentes`}
            </p>
          )}
        </div>
      )}

      {!isCompleted && (
        <button
          type="button"
          onClick={() => onComplete(lesson)}
          className="mt-4 w-full rounded-xl border border-[var(--toq-accent)] bg-[var(--toq-accent)]/5 py-2.5 text-sm font-bold text-[var(--toq-accent)] hover:bg-[var(--toq-accent)]/10"
        >
          Concluir aula
        </button>
      )}
    </article>
  );
}
