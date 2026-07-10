import { STAFF_ROLE_LABELS } from "@/lib/staff";
import type { StaffRole } from "@/types/staff";

type Props = {
  role: StaffRole | null | undefined;
};

const ROLE_CLASS: Record<StaffRole, string> = {
  ceo: "staff-badge staff-badge--ceo",
  cto: "staff-badge staff-badge--cto",
  moderator: "staff-badge staff-badge--moderator",
  marketing: "staff-badge staff-badge--marketing",
};

export function StaffBadge({ role }: Props) {
  if (!role) return null;

  return (
    <span className={ROLE_CLASS[role]} title={`Equipe Toq · ${STAFF_ROLE_LABELS[role]}`}>
      <span className="staff-badge__shine" aria-hidden />
      <span className="staff-badge__label">{STAFF_ROLE_LABELS[role]}</span>
    </span>
  );
}
