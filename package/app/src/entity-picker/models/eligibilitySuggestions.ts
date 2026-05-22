import {
  type CreditAttributionRole,
  creditAttributionRoleRegistry,
  creditAttributionRoles,
  type EntityKind,
  type SubjectAttributionRole,
  subjectAttributionRoleRegistry,
  subjectAttributionRoles,
} from "@rezics/contract";

export function suggestCreditEligibility(
  kind: EntityKind,
  selectedRole?: CreditAttributionRole,
): CreditAttributionRole[] {
  return withSelectedRole(
    creditAttributionRoles.filter((role) =>
      creditAttributionRoleRegistry[role].entityKindHints.includes(kind),
    ),
    selectedRole,
  );
}

export function suggestSubjectEligibility(
  kind: EntityKind,
  selectedRole?: SubjectAttributionRole,
): SubjectAttributionRole[] {
  return withSelectedRole(
    subjectAttributionRoles.filter((role) =>
      subjectAttributionRoleRegistry[role].entityKindHints.includes(kind),
    ),
    selectedRole,
  );
}

function withSelectedRole<Role extends string>(
  roles: readonly Role[],
  selectedRole?: Role,
): Role[] {
  return selectedRole && !roles.includes(selectedRole)
    ? [...roles, selectedRole]
    : [...roles];
}
