import type { PolicyInput } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import {
  type GovernanceAuditListQuery,
  type GovernanceListQuery,
  governanceApi,
} from "./governance.api";
import { governanceKeys } from "./governance.keys";

export const governanceCapabilityHintsQuery = () =>
  queryOptions({
    queryKey: governanceKeys.capabilityHints(),
    queryFn: () => governanceApi.capabilityHints(),
    staleTime: 1000 * 60,
  });

export const governancePolicyDecisionQuery = (input: PolicyInput) =>
  queryOptions({
    queryKey: governanceKeys.policyDecision(input),
    queryFn: () => governanceApi.decidePolicy(input),
    staleTime: 1000 * 30,
  });

export const governanceActiveEnforcementQuery = (targetUserId: string) =>
  queryOptions({
    queryKey: governanceKeys.enforcementActive(targetUserId),
    queryFn: () => governanceApi.activeEnforcement(targetUserId),
    enabled: targetUserId.length > 0,
    staleTime: 1000 * 30,
  });

export const governanceEnforcementListQuery = (
  targetUserId: string,
  query?: GovernanceListQuery,
) =>
  queryOptions({
    queryKey: governanceKeys.enforcementList(targetUserId, query),
    queryFn: () => governanceApi.listEnforcement(targetUserId, query),
    enabled: targetUserId.length > 0,
    staleTime: 1000 * 30,
  });

export const governanceCaseListQuery = (query?: GovernanceListQuery) =>
  queryOptions({
    queryKey: governanceKeys.caseList(query),
    queryFn: () => governanceApi.listCases(query),
    staleTime: 1000 * 30,
  });

export const governanceCaseDetailQuery = (caseId: string) =>
  queryOptions({
    queryKey: governanceKeys.caseDetail(caseId),
    queryFn: () => governanceApi.getCase(caseId),
    enabled: caseId.length > 0,
    staleTime: 1000 * 30,
  });

export const governanceCaseActionsQuery = (
  caseId: string,
  query?: GovernanceListQuery,
) =>
  queryOptions({
    queryKey: governanceKeys.caseActions(caseId, query),
    queryFn: () => governanceApi.listCaseActions(caseId, query),
    enabled: caseId.length > 0,
    staleTime: 1000 * 30,
  });

export const governanceRealmCaseListQuery = (
  realmUnitId: string,
  query?: GovernanceListQuery,
) =>
  queryOptions({
    queryKey: governanceKeys.realmCaseList(realmUnitId, query),
    queryFn: () => governanceApi.listRealmCases(realmUnitId, query),
    enabled: realmUnitId.length > 0,
    staleTime: 1000 * 30,
  });

export const governanceEscalatedRealmCasesQuery = (
  query?: GovernanceListQuery,
) =>
  queryOptions({
    queryKey: governanceKeys.realmCasesEscalated(query),
    queryFn: () => governanceApi.listEscalatedRealmCases(query),
    staleTime: 1000 * 30,
  });

export const governanceRealmCaseActionsQuery = (
  realmUnitId: string,
  caseId: string,
  query?: GovernanceListQuery,
) =>
  queryOptions({
    queryKey: governanceKeys.realmCaseActions(realmUnitId, caseId, query),
    queryFn: () =>
      governanceApi.listRealmCaseActions(realmUnitId, caseId, query),
    enabled: realmUnitId.length > 0 && caseId.length > 0,
    staleTime: 1000 * 30,
  });

export const governanceContentModerationQuery = (targetUnitId: string) =>
  queryOptions({
    queryKey: governanceKeys.contentModeration(targetUnitId),
    queryFn: () => governanceApi.getGlobalContentModeration(targetUnitId),
    enabled: targetUnitId.length > 0,
    staleTime: 1000 * 30,
  });

export const governanceTargetActionsQuery = (
  targetKind: string,
  targetId: string,
  query?: GovernanceListQuery,
) =>
  queryOptions({
    queryKey: governanceKeys.targetActions(targetKind, targetId, query),
    queryFn: () => governanceApi.listTargetActions(targetKind, targetId, query),
    enabled: targetKind.length > 0 && targetId.length > 0,
    staleTime: 1000 * 30,
  });

export const governanceAuditListQuery = (query?: GovernanceAuditListQuery) =>
  queryOptions({
    queryKey: governanceKeys.auditList(query),
    queryFn: () => governanceApi.listAudit(query),
    staleTime: 1000 * 30,
  });

export const governanceAuditDetailQuery = (auditLogId: string) =>
  queryOptions({
    queryKey: governanceKeys.auditDetail(auditLogId),
    queryFn: () => governanceApi.getAudit(auditLogId),
    enabled: auditLogId.length > 0,
    staleTime: 1000 * 60,
  });

export const governanceQueries = {
  capabilityHints: governanceCapabilityHintsQuery,
  policyDecision: governancePolicyDecisionQuery,
  activeEnforcement: governanceActiveEnforcementQuery,
  enforcementList: governanceEnforcementListQuery,
  caseList: governanceCaseListQuery,
  caseDetail: governanceCaseDetailQuery,
  caseActions: governanceCaseActionsQuery,
  realmCaseList: governanceRealmCaseListQuery,
  escalatedRealmCases: governanceEscalatedRealmCasesQuery,
  realmCaseActions: governanceRealmCaseActionsQuery,
  contentModeration: governanceContentModerationQuery,
  targetActions: governanceTargetActionsQuery,
  auditList: governanceAuditListQuery,
  auditDetail: governanceAuditDetailQuery,
};
