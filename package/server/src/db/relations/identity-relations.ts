import type { ServerRelationsBuilder } from "./types";

export function identityRelations(r: ServerRelationsBuilder) {
  return {
    User: {
      AccountEnforcements_decidedById: r.many.AccountEnforcement({
        alias: "AccountEnforcement_decidedById_User_unitId",
      }),
      AccountEnforcements_revokedById: r.many.AccountEnforcement({
        alias: "AccountEnforcement_revokedById_User_unitId",
      }),
      AccountEnforcements_targetUserId: r.many.AccountEnforcement({
        alias: "AccountEnforcement_targetUserId_User_unitId",
      }),
      ApiTokens: r.many.ApiToken(),
      Comments: r.many.Comment(),
      HistoryOutboxes_actorUserId: r.many.HistoryOutbox({
        alias: "HistoryOutbox_actorUserId_User_unitId",
      }),
      HistoryOutboxes_processedById: r.many.HistoryOutbox({
        alias: "HistoryOutbox_processedById_User_unitId",
      }),
      ModerationActions: r.many.ModerationAction(),
      ModerationCases_assignedToUserId: r.many.ModerationCase({
        alias: "ModerationCase_assignedToUserId_User_unitId",
      }),
      ModerationCases_reporterUserId: r.many.ModerationCase({
        alias: "ModerationCase_reporterUserId_User_unitId",
      }),
      ModerationCases_subjectUserId: r.many.ModerationCase({
        alias: "ModerationCase_subjectUserId_User_unitId",
      }),
      RealmCapabilityGrants_grantedById: r.many.RealmCapabilityGrant({
        alias: "RealmCapabilityGrant_grantedById_User_unitId",
      }),
      RealmCapabilityGrants_revokedById: r.many.RealmCapabilityGrant({
        alias: "RealmCapabilityGrant_revokedById_User_unitId",
      }),
      RealmRuleAcknowledgements: r.many.RealmRuleAcknowledgement(),
      RealmRuleRevisions_createdByUserId: r.many.RealmRuleRevision({
        alias: "RealmRuleRevision_createdByUserId_User_unitId",
      }),
      StaffAuditLogs: r.many.StaffAuditLog(),
      StaffGrants_grantedById: r.many.StaffGrant({
        alias: "StaffGrant_grantedById_User_unitId",
      }),
      StaffGrants_revokedById: r.many.StaffGrant({
        alias: "StaffGrant_revokedById_User_unitId",
      }),
      StaffGrants_userId: r.many.StaffGrant({
        alias: "StaffGrant_userId_User_unitId",
      }),
      Units_via_Unit: r.many.Unit({
        alias: "Unit_id_User_unitId_via_Unit",
      }),
      UnitAliases_createdById: r.many.UnitAlias({
        alias: "UnitAlias_createdById_User_unitId",
      }),
      UnitAliases_updatedById: r.many.UnitAlias({
        alias: "UnitAlias_updatedById_User_unitId",
      }),
      UnitAliases_via_UnitAliasVote: r.many.UnitAlias({
        alias: "UnitAlias_id_User_unitId_via_UnitAliasVote",
      }),
      UnitCollaborators_addedById: r.many.UnitCollaborator({
        alias: "UnitCollaborator_addedById_User_unitId",
      }),
      UnitCollaborators_userId: r.many.UnitCollaborator({
        alias: "UnitCollaborator_userId_User_unitId",
      }),
      Units_via_UnitFieldLock: r.many.Unit({
        from: r.User.unitId.through(r.UnitFieldLock.lockedById),
        to: r.Unit.id.through(r.UnitFieldLock.unitId),
        alias: "User_unitId_Unit_id_via_UnitFieldLock",
      }),
      ContentStructureNodes: r.many.ContentStructureNode(),
      UserTagApplications: r.many.UserTagApplication(),
      UserUnitProgresses: r.many.UserUnitProgress(),
    },
    ApiToken: {
      User: r.one.User({
        from: r.ApiToken.userId,
        to: r.User.unitId,
      }),
    },
  };
}
