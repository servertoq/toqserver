import type { StaffRole } from "@/types/staff";
import type { SupportTopic } from "@/types/support";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ceo: "CEO",
  cto: "CTO",
  moderator: "Moderador",
  marketing: "Marketing",
};

export function isStaffAdmin(role: StaffRole | null): boolean {
  return role === "ceo" || role === "cto";
}

export function canModeratePlatform(role: StaffRole | null): boolean {
  return role === "ceo" || role === "cto" || role === "moderator";
}

export function canAccessTicketBox(role: StaffRole | null, topic: SupportTopic): boolean {
  if (!role) return false;
  if (canModeratePlatform(role)) return true;
  return role === "marketing" && topic === "suggestion";
}

export function canManageStaff(role: StaffRole | null): boolean {
  return isStaffAdmin(role);
}

export function canManageAdvertising(role: StaffRole | null): boolean {
  return role === "ceo" || role === "cto" || role === "marketing";
}

export function canAccessClubRecommendations(role: StaffRole | null): boolean {
  if (!role) return false;
  if (canModeratePlatform(role)) return true;
  return role === "marketing";
}
