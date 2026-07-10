"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { fetchMyCoachListing } from "@/lib/coachListings";
import {
  completeCoachLesson,
  createScheduledLesson,
  emptyCoachLessonForm,
  fetchCoachScheduledLessons,
  fetchMyListingEnrollments,
  removeEnrollment,
  updateEnrollmentStatus,
} from "@/lib/coachManagement";
import type { CoachListingEnrollmentWithProfile, CoachScheduledLesson } from "@/types/coachManagement";
import { COACH_LESSON_FORMAT_LABELS } from "@/types/coachManagement";
import type { CoachListingWithProfile } from "@/types/coachListings";
import { appContentClass } from "@/lib/layout";
import { PageHeader } from "@/components/shared/PageHeader";
import { CoachEnrollmentCard } from "./CoachEnrollmentCard";
import { CoachLessonCard } from "./CoachLessonCard";
import { CoachLessonCompleteDialog } from "./CoachLessonCompleteDialog";
import { useSingleSubmit } from "@/lib/useSingleSubmit";

type Tab = "leads" | "students" | "schedule" | "lessons";

export function CoachManagementPage() {
  const supabase = createClient();
  const profile = useAppProfile();
  const [listing, setListing] = useState<CoachListingWithProfile | null>(null);
  const [enrollments, setEnrollments] = useState<CoachListingEnrollmentWithProfile[]>([]);
  const [lessons, setLessons] = useState<CoachScheduledLesson[]>([]);
  const [tab, setTab] = useState<Tab>("leads");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState(emptyCoachLessonForm());
  const [studentPickerSearch, setStudentPickerSearch] = useState("");
  const [includeLeadsInSchedule, setIncludeLeadsInSchedule] = useState(false);
  const [completeLessonTarget, setCompleteLessonTarget] = useState<CoachScheduledLesson | null>(null);
  const { isSubmitting: savingLesson, guard } = useSingleSubmit();

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const mine = await fetchMyCoachListing(supabase, profile.id);
      setListing(mine);
      if (!mine) {
        setEnrollments([]);
        setLessons([]);
        return;
      }
      const [enrolls, scheduled] = await Promise.all([
        fetchMyListingEnrollments(supabase, mine.id),
        fetchCoachScheduledLessons(supabase, mine.id),
      ]);
      setEnrollments(enrolls);
      setLessons(scheduled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [profile.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const leads = useMemo(
    () => enrollments.filter((e) => e.status === "lead"),
    [enrollments]
  );
  const students = useMemo(
    () => enrollments.filter((e) => e.status === "student"),
    [enrollments]
  );
  const selectableForSchedule = useMemo(() => {
    const pool = includeLeadsInSchedule ? enrollments : students;
    const q = studentPickerSearch.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((e) => e.student.username.toLowerCase().includes(q));
  }, [enrollments, includeLeadsInSchedule, studentPickerSearch, students]);

  const selectedCount = lessonForm.student_ids.length;

  const lastLessonInviteeIds = useMemo(() => {
    if (lessons.length === 0) return [] as string[];
    const latest = lessons[0];
    return (latest.attendees ?? []).map((a) => a.student_id);
  }, [lessons]);

  async function handleMoveToStudents(id: string) {
    const { error: err } = await updateEnrollmentStatus(supabase, id, "student");
    if (err) {
      setError(err);
      return;
    }
    setMessage("Aluno movido para a aba Alunos.");
    await load();
  }

  async function handleRemove(id: string) {
    const { error: err } = await removeEnrollment(supabase, id);
    if (err) {
      setError(err);
      return;
    }
    setMessage("Removido da lista.");
    await load();
  }

  function selectAllVisibleStudents() {
    const ids = selectableForSchedule.map((e) => e.student_id);
    setLessonForm((f) => ({
      ...f,
      student_ids: Array.from(new Set([...f.student_ids, ...ids])),
    }));
  }

  function clearStudentSelection() {
    setLessonForm((f) => ({ ...f, student_ids: [] }));
  }

  function repeatLastLessonInvitees() {
    const pool = new Set(
      (includeLeadsInSchedule ? enrollments : students).map((e) => e.student_id)
    );
    const ids = lastLessonInviteeIds.filter((id) => pool.has(id));
    if (ids.length === 0) return;
    setLessonForm((f) => ({ ...f, student_ids: ids }));
  }

  function toggleStudent(id: string) {
    setLessonForm((f) => ({
      ...f,
      student_ids: f.student_ids.includes(id)
        ? f.student_ids.filter((s) => s !== id)
        : [...f.student_ids, id],
    }));
  }

  async function handleCompleteLesson(payload: {
    session_report: string;
    attendance: { student_id: string; attended: boolean }[];
  }) {
    if (!completeLessonTarget) return;
    const { error: err } = await completeCoachLesson(supabase, completeLessonTarget.id, payload);
    if (err) throw new Error(err);
    setMessage("Aula concluída com presença e relatório salvos.");
    setCompleteLessonTarget(null);
    await load();
  }

  async function handleScheduleLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;

    if (lessonForm.theme.trim().length < 2) {
      setError("Informe o tema da aula.");
      return;
    }
    if (!lessonForm.lesson_date || !lessonForm.lesson_time) {
      setError("Informe data e horário.");
      return;
    }
    if (lessonForm.student_ids.length === 0) {
      setError("Selecione pelo menos um aluno.");
      return;
    }

    await guard(async () => {
      setError(null);
      const { error: createErr } = await createScheduledLesson(supabase, listing.id, lessonForm);
      if (createErr) {
        setError(createErr);
        return;
      }
      setMessage("Aula cadastrada! Os alunos foram notificados e a agenda foi atualizada.");
      setLessonForm(emptyCoachLessonForm());
      setTab("lessons");
      await load();
    });
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "leads", label: "Leads", count: leads.length },
    { id: "students", label: "Alunos", count: students.length },
    { id: "schedule", label: "Cadastrar aula" },
    { id: "lessons", label: "Aulas agendadas", count: lessons.length },
  ];

  if (loading) {
    return (
      <main className={appContentClass}>
        <p className="text-sm text-[var(--toq-text-muted)]">Carregando gestão de aulas…</p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className={appContentClass}>
        <PageHeader
          kicker=""
          title="Gestão de Aulas"
          subtitle="Você precisa divulgar suas aulas em Aprenda à Jogar para acessar este painel."
        />
      </main>
    );
  }

  return (
    <main className={appContentClass}>
      <PageHeader
        kicker="Professor"
        title="Gestão de Aulas"
        subtitle={`Painel de leads e alunos — ${listing.title}`}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800" role="status">
          {message}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setMessage(null);
            }}
            className={`rounded-t-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "border-b-2 border-[var(--toq-accent)] text-[var(--toq-navy)]"
                : "text-[var(--toq-text-muted)] hover:text-[var(--toq-navy)]"
            }`}
          >
            {t.label}
            {t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {tab === "leads" && (
        <section>
          {leads.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-[var(--toq-text-muted)]">
              Nenhum lead ainda. Quando alguém clicar em &quot;Inscrever-se&quot; na sua divulgação, aparecerá aqui.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {leads.map((e) => (
                <CoachEnrollmentCard
                  key={e.id}
                  enrollment={e}
                  onMoveToStudents={handleMoveToStudents}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "students" && (
        <section>
          {students.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-[var(--toq-text-muted)]">
              Nenhum aluno ainda. Mova leads para esta aba quando fechar a matrícula.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {students.map((e) => (
                <CoachEnrollmentCard
                  key={e.id}
                  enrollment={e}
                  showMoveToStudents={false}
                  onMoveToStudents={handleMoveToStudents}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "schedule" && (
        <section className="mx-auto max-w-xl">
          <form onSubmit={handleScheduleLesson} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Tema da aula</span>
              <input
                value={lessonForm.theme}
                onChange={(e) => setLessonForm((f) => ({ ...f, theme: e.target.value }))}
                required
                maxLength={120}
                placeholder="Ex.: Forehand e backhand"
                className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Duração (min)</span>
                <input
                  type="number"
                  min={15}
                  max={480}
                  value={lessonForm.duration_minutes}
                  onChange={(e) => setLessonForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                  className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Formato</span>
                <select
                  value={lessonForm.lesson_format}
                  onChange={(e) =>
                    setLessonForm((f) => ({
                      ...f,
                      lesson_format: e.target.value as typeof f.lesson_format,
                    }))
                  }
                  className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
                >
                  {Object.entries(COACH_LESSON_FORMAT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Data</span>
                <input
                  type="date"
                  value={lessonForm.lesson_date}
                  onChange={(e) => setLessonForm((f) => ({ ...f, lesson_date: e.target.value }))}
                  required
                  className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--toq-navy)]">Horário</span>
                <input
                  type="time"
                  value={lessonForm.lesson_time}
                  onChange={(e) => setLessonForm((f) => ({ ...f, lesson_time: e.target.value }))}
                  required
                  className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Local / link / detalhes</span>
              <input
                value={lessonForm.location_detail}
                onChange={(e) => setLessonForm((f) => ({ ...f, location_detail: e.target.value }))}
                maxLength={200}
                placeholder="Endereço, quadra, link do Meet…"
                className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Observações (opcional)</span>
              <textarea
                value={lessonForm.notes}
                onChange={(e) => setLessonForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                maxLength={500}
                className="toq-input mt-1 w-full px-3 py-2.5 text-sm"
              />
            </label>

            <fieldset>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="text-xs font-semibold text-[var(--toq-navy)]">
                  Alunos que receberão notificação e agenda ({selectedCount} selecionado
                  {selectedCount === 1 ? "" : "s"})
                </legend>
                <label className="flex items-center gap-2 text-xs text-[var(--toq-text-muted)]">
                  <input
                    type="checkbox"
                    checked={includeLeadsInSchedule}
                    onChange={(e) => setIncludeLeadsInSchedule(e.target.checked)}
                  />
                  Incluir leads
                </label>
              </div>
              <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
                Apenas os alunos marcados recebem a notificação e o evento na agenda. Você pode
                convidar os mesmos alunos em várias aulas — cada agendamento é independente.
              </p>
              {students.length === 0 && !includeLeadsInSchedule ? (
                <p className="mt-2 text-xs text-[var(--toq-text-muted)]">
                  Nenhum aluno na aba Alunos. Mova leads para Alunos ou marque &quot;Incluir
                  leads&quot;.
                </p>
              ) : (
                <>
                  <input
                    type="search"
                    value={studentPickerSearch}
                    onChange={(e) => setStudentPickerSearch(e.target.value)}
                    placeholder="Buscar aluno por @usuário…"
                    className="toq-input mt-3 w-full px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lastLessonInviteeIds.length > 0 && (
                      <button
                        type="button"
                        onClick={repeatLastLessonInvitees}
                        className="rounded-lg border border-[var(--toq-accent)]/40 bg-[var(--toq-accent)]/5 px-2.5 py-1 text-xs font-semibold text-[var(--toq-accent)]"
                      >
                        Repetir convidados da última aula
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={selectAllVisibleStudents}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[var(--toq-navy)]"
                    >
                      Selecionar visíveis
                    </button>
                    <button
                      type="button"
                      onClick={clearStudentSelection}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[var(--toq-text-muted)]"
                    >
                      Limpar seleção
                    </button>
                  </div>
                  <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                    {selectableForSchedule.map((e) => (
                      <li key={e.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={lessonForm.student_ids.includes(e.student_id)}
                            onChange={() => toggleStudent(e.student_id)}
                          />
                          <span>
                            @{e.student.username}
                            <span className="ml-1 text-xs text-[var(--toq-text-muted)]">
                              ({e.status === "student" ? "aluno" : "lead"})
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </fieldset>

            <button
              type="submit"
              disabled={savingLesson || lessonForm.student_ids.length === 0}
              className="w-full rounded-xl toq-btn-primary py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {savingLesson
                ? "Salvando…"
                : `Agendar para ${selectedCount} aluno${selectedCount === 1 ? "" : "s"}`}
            </button>
          </form>
        </section>
      )}

      {tab === "lessons" && (
        <section className="space-y-3">
          {lessons.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-[var(--toq-text-muted)]">
              Nenhuma aula agendada ainda.
            </p>
          ) : (
            lessons.map((lesson) => (
              <CoachLessonCard
                key={lesson.id}
                lesson={lesson}
                onComplete={setCompleteLessonTarget}
              />
            ))
          )}
        </section>
      )}

      <CoachLessonCompleteDialog
        open={!!completeLessonTarget}
        lesson={completeLessonTarget}
        onClose={() => setCompleteLessonTarget(null)}
        onConfirm={handleCompleteLesson}
      />
    </main>
  );
}
