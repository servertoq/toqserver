import type { Community, CommunityMember, CommunityMemberRole } from "@/types/community";

export function communityVisibilityLabel(isPrivate: boolean) {
  return isPrivate ? "Privada" : "Pública";
}

export function memberRoleLabel(role: CommunityMemberRole) {
  if (role === "owner") return "Administrador";
  if (role === "moderator") return "Moderador";
  return "Membro";
}

export function canModerate(role: CommunityMemberRole | null | undefined) {
  return role === "owner" || role === "moderator";
}

export function isOwner(role: CommunityMemberRole | null | undefined) {
  return role === "owner";
}

export type CommunityWithMembership = Community & {
  my_role: CommunityMemberRole | null;
  pending_request: boolean;
  pending_invite: boolean;
};

export function mapCommunityRow(
  row: Community,
  myRole: CommunityMemberRole | null,
  pendingRequest: boolean,
  pendingInvite = false
): CommunityWithMembership {
  return {
    ...row,
    kind: row.kind ?? "community",
    my_role: myRole,
    pending_request: pendingRequest,
    pending_invite: pendingInvite,
  };
}

export function groupVisibilityLabel(kind: Community["kind"], isPrivate: boolean) {
  if (kind === "club") return "Privado";
  return communityVisibilityLabel(isPrivate);
}

export function sortMembers(members: CommunityMember[]) {
  const order: Record<CommunityMemberRole, number> = {
    owner: 0,
    moderator: 1,
    member: 2,
  };
  return [...members].sort((a, b) => order[a.role] - order[b.role]);
}
