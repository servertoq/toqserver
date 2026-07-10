"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { profileDisplayName } from "@/lib/profile";
import type { CoachLessonAttendee, CoachScheduledLesson } from "@/types/coachManagement";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type AttendanceMap = Record<string, boolean>;

type Props = {
  open: boolean;
  lesson: CoachScheduledLesson | null;
  onClose: () => void;
  onConfirm: (payload: {
    session_report: string;
    attendance: { student_id: string; attended: boolean }[];
  }) => Promise<void>;
};

export function CoachLessonCompleteDialog({ open, lesson, onClose, onConfirm }: Props) {
  const [mounted, setMounted] = useState(false);
  const [report, setReport] = useState("");
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [error, setError] = useState<string | null>(null);
  const { isSubmitting, guard } = useSingleSubmit();

  const attendees = lesson?.attendees ?? [];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !lesson) return;
    const initial: AttendanceMap = {};
    for (const a of lesson.attendees ?? []) {
      initial[a.student_id] = true;
    }
    setAttendance(initial);
    setReport("");
    setError(null);
  }, [open, lesson]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function toggleAttendance(studentId: string) {
    setAttendance((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lesson) return;

    if (report.trim().length < 10) {
      setError("Descreva o que aconteceu na aula (mínimo 10 caracteres).");
      return;
    }

    const payload = attendees.map((a) => ({
      student_id: a.student_id,
      attended: attendance[a.student_id] ?? false,
    }));

    await guard(async () => {
      setError(null);
      try {
        await onConfirm({ session_report: report.trim(), attendance: payload });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível concluir a aula.");
      }
    });
  }

  if (!open || !mounted || !lesson) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-lesson-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-white shadow-xl sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="complete-lesson-title" className="text-lg font-bold text-[var(--toq-navy)]">
            Concluir aula
          </h2>
          <p className="mt-1 text-sm text-[var(--toq-text-muted)]">{lesson.theme}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          {error && (
            <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <fieldset className="mb-4">
            <legend className="text-xs font-semibold text-[var(--toq-navy)]">
              Presença dos alunos convidados ({attendees.length})
            </legend>
            <ul className="mt-2 space-y-2">
              {attendees.map((a) => (
                <AttendanceRow
                  key={a.id}
                  attendee={a}
                  checked={attendance[a.student_id] ?? false}
                  onToggle={() => toggleAttendance(a.student_id)}
                />
              ))}
            </ul>
          </fieldset>

          <label className="mb-4 block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Relatório da aula</span>
            <textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              rows={5}
              maxLength={3000}
              required
              placeholder="O que foi trabalhado, evolução dos alunos, próximos passos…"
              className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
            />
          </label>

          <div className="mt-auto flex gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-[var(--toq-navy)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl toq-btn-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Salvando…" : "Concluir aula"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function AttendanceRow({
  attendee,
  checked,
  onToggle,
}: {
  attendee: CoachLessonAttendee;
  checked: boolean;
  onToggle: () => void;
}) {
  const name = profileDisplayName(attendee.student);
  return (
    <li>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
        <span>
          <span className="font-semibold text-[var(--toq-navy)]">{name}</span>
          <span className="ml-1 text-xs text-[var(--toq-text-muted)]">@{attendee.student.username}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-xs font-bold ${checked ? "text-emerald-700" : "text-red-600"}`}>
            {checked ? "Presente" : "Faltou"}
          </span>
          <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4" />
        </span>
      </label>
    </li>
  );
}
