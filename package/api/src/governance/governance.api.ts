import type {
  AccountEnforcementDTO,
  ActiveAccountEnforcementSummary,
  AppealModerationCaseInput,
  AssignModerationCaseInput,
  Capability,
  CapabilityGrantDTO,
  CapabilityHint,
  ContentModerationDecisionInput,
  CreateAccountEnforcementInput,
  CreateModerationCaseFromFeedbackInput,
  CreateRealmModerationCaseFromFeedbackInput,
  CreateRealmModerationCaseInput,
  DecideModerationCaseInput,
  DecideRealmModerationCaseInput,
  DuplicateModerationCaseInput,
  EscalateRealmModerationCaseInput,
  GrantCapabilityInput,
  ModerationActionDTO,
  ModerationCaseDTO,
  ModerationOverlayDTO,
  ModerationOverlayRequest,
  PolicyDecision,
  PolicyInput,
  StaffAuditLogDTO,
  TriageModerationCaseInput,
  UnblockAccountEnforcementInput,
  UnitRealmDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export type GovernanceCapabilityHintsResponse = {
  capabilities: CapabilityHint[];
};

export type GovernanceListQuery = {
  offset?: number;
  limit?: number;
};

export type GovernanceAuditListQuery = GovernanceListQuery & {
  actorUserId?: string;
  action?: string;
  targetKind?: string;
  targetId?: string;
  decisionCode?: string;
  requestId?: string;
};

const encodePathPart = (value: string) => encodeURIComponent(value);

export const governanceApi = {
  capabilityHints: async (): Promise<GovernanceCapabilityHintsResponse> => {
    return apiFetch<GovernanceCapabilityHintsResponse>(
      "/governance/capability-hints/me",
    );
  },

  decidePolicy: async (input: PolicyInput): Promise<PolicyDecision> => {
    return apiFetch<PolicyDecision>("/governance/policy/decide", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listTargetActions: async (
    targetKind: string,
    targetId: string,
    query?: GovernanceListQuery,
  ): Promise<ModerationActionDTO[]> => {
    return apiFetch<ModerationActionDTO[]>(
      `/governance/moderation/${encodePathPart(targetKind)}/${encodePathPart(targetId)}/actions${buildQueryString(query)}`,
    );
  },

  getModerationOverlays: async (
    input: ModerationOverlayRequest,
  ): Promise<ModerationOverlayDTO[]> => {
    return apiFetch<ModerationOverlayDTO[]>("/governance/moderation/overlays", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  activeEnforcement: async (
    targetUserId: string,
  ): Promise<ActiveAccountEnforcementSummary> => {
    return apiFetch<ActiveAccountEnforcementSummary>(
      `/governance/enforcement/${encodePathPart(targetUserId)}/active`,
    );
  },

  listEnforcement: async (
    targetUserId: string,
    query?: GovernanceListQuery,
  ): Promise<AccountEnforcementDTO[]> => {
    return apiFetch<AccountEnforcementDTO[]>(
      `/governance/enforcement/${encodePathPart(targetUserId)}${buildQueryString(query)}`,
    );
  },

  applyEnforcement: async (
    targetUserId: string,
    input: CreateAccountEnforcementInput,
  ): Promise<AccountEnforcementDTO> => {
    return apiFetch<AccountEnforcementDTO>(
      `/governance/enforcement/${encodePathPart(targetUserId)}`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  unblockEnforcement: async (
    targetUserId: string,
    input: UnblockAccountEnforcementInput,
  ): Promise<AccountEnforcementDTO[]> => {
    return apiFetch<AccountEnforcementDTO[]>(
      `/governance/enforcement/${encodePathPart(targetUserId)}/unblock`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  grantRealmCapability: async (
    realmUnitId: string,
    userId: string,
    input: GrantCapabilityInput,
  ): Promise<CapabilityGrantDTO> => {
    return apiFetch<CapabilityGrantDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/members/${encodePathPart(userId)}/capabilities`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  revokeRealmCapability: async (
    realmUnitId: string,
    userId: string,
    capability: Capability,
  ): Promise<CapabilityGrantDTO[]> => {
    return apiFetch<CapabilityGrantDTO[]>(
      `/governance/realms/${encodePathPart(realmUnitId)}/members/${encodePathPart(userId)}/capabilities/${encodePathPart(capability)}`,
      { method: "DELETE" },
    );
  },

  listCases: async (
    query?: GovernanceListQuery,
  ): Promise<ModerationCaseDTO[]> => {
    return apiFetch<ModerationCaseDTO[]>(
      `/governance/cases${buildQueryString(query)}`,
    );
  },

  getCase: async (caseId: string): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/cases/${encodePathPart(caseId)}`,
    );
  },

  listCaseActions: async (
    caseId: string,
    query?: GovernanceListQuery,
  ): Promise<ModerationActionDTO[]> => {
    return apiFetch<ModerationActionDTO[]>(
      `/governance/cases/${encodePathPart(caseId)}/actions${buildQueryString(query)}`,
    );
  },

  createCaseFromFeedback: async (
    feedbackId: string,
    input: CreateModerationCaseFromFeedbackInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/cases/from-feedback/${encodePathPart(feedbackId)}`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  duplicateCase: async (
    caseId: string,
    input: DuplicateModerationCaseInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/cases/${encodePathPart(caseId)}/duplicate`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  assignCase: async (
    caseId: string,
    input: AssignModerationCaseInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/cases/${encodePathPart(caseId)}/assign`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  triageCase: async (
    caseId: string,
    input: TriageModerationCaseInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/cases/${encodePathPart(caseId)}/triage`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  decideCase: async (
    caseId: string,
    input: DecideModerationCaseInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/cases/${encodePathPart(caseId)}/decision`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  appealCase: async (
    caseId: string,
    input: AppealModerationCaseInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/cases/${encodePathPart(caseId)}/appeal`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  listRealmCases: async (
    realmUnitId: string,
    query?: GovernanceListQuery,
  ): Promise<ModerationCaseDTO[]> => {
    return apiFetch<ModerationCaseDTO[]>(
      `/governance/realms/${encodePathPart(realmUnitId)}/cases${buildQueryString(query)}`,
    );
  },

  listEscalatedRealmCases: async (
    query?: GovernanceListQuery,
  ): Promise<ModerationCaseDTO[]> => {
    return apiFetch<ModerationCaseDTO[]>(
      `/governance/cases?scope=realm&state=escalated${query ? `&${buildQueryString(query).slice(1)}` : ""}`,
    );
  },

  createRealmCase: async (
    realmUnitId: string,
    input: CreateRealmModerationCaseInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/cases`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  createRealmCaseFromFeedback: async (
    realmUnitId: string,
    feedbackId: string,
    input: CreateRealmModerationCaseFromFeedbackInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/cases/from-feedback/${encodePathPart(feedbackId)}`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  listRealmCaseActions: async (
    realmUnitId: string,
    caseId: string,
    query?: GovernanceListQuery,
  ): Promise<ModerationActionDTO[]> => {
    return apiFetch<ModerationActionDTO[]>(
      `/governance/realms/${encodePathPart(realmUnitId)}/cases/${encodePathPart(caseId)}/actions${buildQueryString(query)}`,
    );
  },

  decideRealmCase: async (
    realmUnitId: string,
    caseId: string,
    input: DecideRealmModerationCaseInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/cases/${encodePathPart(caseId)}/decision`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  escalateRealmCase: async (
    realmUnitId: string,
    caseId: string,
    input: EscalateRealmModerationCaseInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/cases/${encodePathPart(caseId)}/escalate`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  getGlobalContentModeration: async (
    targetUnitId: string,
  ): Promise<ModerationOverlayDTO | null> => {
    const [overlay] = await governanceApi.getModerationOverlays({
      targetKind: "unit",
      targetIds: [targetUnitId],
    });
    return overlay ?? null;
  },

  removeGlobalContent: async (
    targetUnitId: string,
    input: ContentModerationDecisionInput,
  ): Promise<ModerationOverlayDTO | null> => {
    await apiFetch<unknown>(
      `/governance/content/${encodePathPart(targetUnitId)}/remove`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    return governanceApi.getGlobalContentModeration(targetUnitId);
  },

  restoreGlobalContent: async (
    targetUnitId: string,
    input: ContentModerationDecisionInput,
  ): Promise<ModerationOverlayDTO | null> => {
    await apiFetch<unknown>(
      `/governance/content/${encodePathPart(targetUnitId)}/restore`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    return governanceApi.getGlobalContentModeration(targetUnitId);
  },

  approveRealmContent: async (
    realmUnitId: string,
    targetUnitId: string,
    input: ContentModerationDecisionInput,
  ): Promise<UnitRealmDTO> => {
    return apiFetch<UnitRealmDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/content/${encodePathPart(targetUnitId)}/approve`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  removeRealmContent: async (
    realmUnitId: string,
    targetUnitId: string,
    input: ContentModerationDecisionInput,
  ): Promise<UnitRealmDTO> => {
    return apiFetch<UnitRealmDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/content/${encodePathPart(targetUnitId)}/remove`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  restoreRealmContent: async (
    realmUnitId: string,
    targetUnitId: string,
    input: ContentModerationDecisionInput,
  ): Promise<UnitRealmDTO> => {
    return apiFetch<UnitRealmDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/content/${encodePathPart(targetUnitId)}/restore`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  setRealmContentLock: async (
    realmUnitId: string,
    targetUnitId: string,
    isLocked: boolean,
    input: ContentModerationDecisionInput,
  ): Promise<ModerationActionDTO> => {
    return apiFetch<ModerationActionDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/content/${encodePathPart(targetUnitId)}/${isLocked ? "lock" : "unlock"}`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  requestRealmContentOwnerDelegation: async (
    realmUnitId: string,
    targetUnitId: string,
    input: ContentModerationDecisionInput,
  ): Promise<ModerationCaseDTO> => {
    return apiFetch<ModerationCaseDTO>(
      `/governance/realms/${encodePathPart(realmUnitId)}/content/${encodePathPart(targetUnitId)}/owner-delegation`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  listAudit: async (
    query?: GovernanceAuditListQuery,
  ): Promise<StaffAuditLogDTO[]> => {
    return apiFetch<StaffAuditLogDTO[]>(
      `/governance/audit${buildQueryString(query)}`,
    );
  },

  getAudit: async (auditLogId: string): Promise<StaffAuditLogDTO> => {
    return apiFetch<StaffAuditLogDTO>(
      `/governance/audit/${encodePathPart(auditLogId)}`,
    );
  },
};
