import type { FeedProfile } from "@/types/feed";

export type CoachEnrollmentStatus = "lead" | "student";

export type CoachLessonFormat = "presencial" | "online" | "clube" | "outro";

export type CoachListingEnrollment = {
  id: string;
  coach_listing_id: string;
  student_id: string;
  contact_phone: string | null;
  contact_email: string | null;
  status: CoachEnrollmentStatus;
  created_at: string;
  updated_at: string;
};

export type CoachListingEnrollmentWithProfile = CoachListingEnrollment & {
  student: FeedProfile;
};

export type CoachLessonStatus = "scheduled" | "completed";

export type CoachLessonAttendee = {
  id: string;
  student_id: string;
  attended: boolean | null;
  notified_at: string | null;
  student: FeedProfile;
};

export type CoachScheduledLesson = {
  id: string;
  coach_id: string;
  coach_listing_id: string;
  theme: string;
  duration_minutes: number;
  lesson_date: string;
  lesson_time: string;
  lesson_format: CoachLessonFormat;
  location_detail: string | null;
  notes: string | null;
  status: CoachLessonStatus;
  completed_at: string | null;
  session_report: string | null;
  created_at: string;
  updated_at: string;
  attendees?: CoachLessonAttendee[];
};

export type CoachLessonCompleteData = {
  session_report: string;
  attendance: { student_id: string; attended: boolean }[];
};

export type CoachLessonFormData = {
  theme: string;
  duration_minutes: string;
  lesson_date: string;
  lesson_time: string;
  lesson_format: CoachLessonFormat;
  location_detail: string;
  notes: string;
  student_ids: string[];
};

export type CoachEnrollFormData = {
  contact_phone: string;
  contact_email: string;
};

export const COACH_LESSON_FORMAT_LABELS: Record<CoachLessonFormat, string> = {
  presencial: "Presencial",
  online: "Online",
  clube: "Clube / quadra",
  outro: "Outro",
};
