import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoachEnrollFormData,
  CoachLessonCompleteData,
  CoachLessonFormData,
  CoachLessonAttendee,
  CoachListingEnrollmentWithProfile,
  CoachScheduledLesson,
} from "@/types/coachManagement";
import type { FeedProfile } from "@/types/feed";

const ENROLLMENT_SELECT = `
  id,
  coach_listing_id,
  student_id,
  contact_phone,
  contact_email,
  status,
  created_at,
  updated_at,
  student:profiles!coach_listing_enrollments_student_id_fkey(id, username, avatar_url, display_name)
`;

const LESSON_SELECT = `
  id,
  coach_id,
  coach_listing_id,
  theme,
  duration_minutes,
  lesson_date,
  lesson_time,
  lesson_format,
  location_detail,
  notes,
  status,
  completed_at,
  session_report,
  created_at,
  updated_at,
  attendees:coach_lesson_attendees(
    id,
    student_id,
    attended,
    notified_at,
    student:profiles!coach_lesson_attendees_student_id_fkey(id, username, avatar_url, display_name)
  )
`;

function mapEnrollmentRow(row: Record<string, unknown>): CoachListingEnrollmentWithProfile {
  const student = Array.isArray(row.student) ? row.student[0] : row.student;
  const { student: _s, ...rest } = row;
  return {
    ...(rest as CoachListingEnrollmentWithProfile),
    student: student as FeedProfile,
  };
}

export async function checkCoachManagementAccess(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_can_access_coach_management");
  if (error) return false;
  return Boolean(data);
}

export async function fetchMyListingEnrollments(
  supabase: SupabaseClient,
  listingId: string
): Promise<CoachListingEnrollmentWithProfile[]> {
  const { data, error } = await supabase
    .from("coach_listing_enrollments")
    .select(ENROLLMENT_SELECT)
    .eq("coach_listing_id", listingId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapEnrollmentRow(row as Record<string, unknown>));
}

export async function fetchMyEnrollmentForListing(
  supabase: SupabaseClient,
  listingId: string,
  studentId: string
) {
  const { data, error } = await supabase
    .from("coach_listing_enrollments")
    .select("id, status")
    .eq("coach_listing_id", listingId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function enrollInCoachListing(
  supabase: SupabaseClient,
  listingId: string,
  form: CoachEnrollFormData
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("enroll_in_coach_listing", {
    p_listing_id: listingId,
    p_contact_phone: form.contact_phone.trim() || null,
    p_contact_email: form.contact_email.trim() || null,
  });

  return { error: error?.message ?? null };
}

export async function updateEnrollmentStatus(
  supabase: SupabaseClient,
  enrollmentId: string,
  status: "lead" | "student"
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("coach_update_enrollment_status", {
    p_enrollment_id: enrollmentId,
    p_status: status,
  });
  return { error: error?.message ?? null };
}

export async function removeEnrollment(
  supabase: SupabaseClient,
  enrollmentId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("coach_remove_enrollment", {
    p_enrollment_id: enrollmentId,
  });
  return { error: error?.message ?? null };
}

export async function createScheduledLesson(
  supabase: SupabaseClient,
  listingId: string,
  form: CoachLessonFormData
): Promise<{ lessonId: string | null; error: string | null }> {
  const duration = parseInt(form.duration_minutes, 10);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { lessonId: null, error: "Informe a duração em minutos." };
  }

  const { data, error } = await supabase.rpc("coach_create_scheduled_lesson", {
    p_listing_id: listingId,
    p_theme: form.theme.trim(),
    p_duration_minutes: duration,
    p_lesson_date: form.lesson_date,
    p_lesson_time: form.lesson_time,
    p_lesson_format: form.lesson_format,
    p_location_detail: form.location_detail.trim() || null,
    p_notes: form.notes.trim() || null,
    p_student_ids: form.student_ids,
  });

  if (error) return { lessonId: null, error: error.message };
  return { lessonId: data as string, error: null };
}

export async function fetchCoachScheduledLessons(
  supabase: SupabaseClient,
  listingId: string
): Promise<CoachScheduledLesson[]> {
  const { data, error } = await supabase
    .from("coach_scheduled_lessons")
    .select(LESSON_SELECT)
    .eq("coach_listing_id", listingId)
    .order("lesson_date", { ascending: false })
    .order("lesson_time", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapLessonRow(row as Record<string, unknown>));
}

function mapLessonRow(row: Record<string, unknown>): CoachScheduledLesson {
  const attendeesRaw = row.attendees;
  const attendeesList = Array.isArray(attendeesRaw) ? attendeesRaw : [];
  const { attendees: _a, ...lesson } = row;

  return {
    ...(lesson as CoachScheduledLesson),
    status: (lesson.status as CoachScheduledLesson["status"]) ?? "scheduled",
    attendees: attendeesList.map((a) => {
      const item = a as Record<string, unknown>;
      const student = Array.isArray(item.student) ? item.student[0] : item.student;
      return {
        ...(item as CoachLessonAttendee),
        student: student as FeedProfile,
      };
    }),
  };
}

export async function completeCoachLesson(
  supabase: SupabaseClient,
  lessonId: string,
  data: CoachLessonCompleteData
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("coach_complete_lesson", {
    p_lesson_id: lessonId,
    p_session_report: data.session_report.trim(),
    p_attendance: data.attendance,
  });
  return { error: error?.message ?? null };
}

export function emptyCoachLessonForm(): CoachLessonFormData {
  return {
    theme: "",
    duration_minutes: "60",
    lesson_date: "",
    lesson_time: "",
    lesson_format: "presencial",
    location_detail: "",
    notes: "",
    student_ids: [],
  };
}

export function emptyCoachEnrollForm(email = ""): CoachEnrollFormData {
  return {
    contact_phone: "",
    contact_email: email,
  };
}

export function formatLessonSchedule(lesson: Pick<CoachScheduledLesson, "lesson_date" | "lesson_time">) {
  const date = new Date(`${lesson.lesson_date}T12:00:00`);
  const dateLabel = date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const time = lesson.lesson_time.slice(0, 5);
  return `${dateLabel} às ${time}`;
}
