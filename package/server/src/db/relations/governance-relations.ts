import type { ServerRelationsBuilder } from "./types";

export function governanceRelations(r: ServerRelationsBuilder) {
  return {
    AccountEnforcement: {
      User_decidedById: r.one.User({
        from: r.AccountEnforcement.decidedById,
        to: r.User.unitId,
        alias: "AccountEnforcement_decidedById_User_unitId",
      }),
      ModerationAction_decisionActionId: r.one.ModerationAction({
        from: r.AccountEnforcement.decisionActionId,
        to: r.ModerationAction.id,
        alias: "AccountEnforcement_decisionActionId_ModerationAction_id",
      }),
      ModerationAction_revocationActionId: r.one.ModerationAction({
        from: r.AccountEnforcement.revocationActionId,
        to: r.ModerationAction.id,
        alias: "AccountEnforcement_revocationActionId_ModerationAction_id",
      }),
      User_revokedById: r.one.User({
        from: r.AccountEnforcement.revokedById,
        to: r.User.unitId,
        alias: "AccountEnforcement_revokedById_User_unitId",
      }),
      User_targetUserId: r.one.User({
        from: r.AccountEnforcement.targetUserId,
        to: r.User.unitId,
        alias: "AccountEnforcement_targetUserId_User_unitId",
      }),
    },
    ModerationAction: {
      AccountEnforcements_decisionActionId: r.many.AccountEnforcement({
        alias: "AccountEnforcement_decisionActionId_ModerationAction_id",
      }),
      AccountEnforcements_revocationActionId: r.many.AccountEnforcement({
        alias: "AccountEnforcement_revocationActionId_ModerationAction_id",
      }),
      User: r.one.User({
        from: r.ModerationAction.actorUserId,
        to: r.User.unitId,
      }),
      ModerationCase: r.one.ModerationCase({
        from: r.ModerationAction.caseId,
        to: r.ModerationCase.id,
      }),
      Unit: r.one.Unit({
        from: r.ModerationAction.realmUnitId,
        to: r.Unit.id,
      }),
      ModerationAction: r.one.ModerationAction({
        from: r.ModerationAction.reversesActionId,
        to: r.ModerationAction.id,
        alias: "ModerationAction_reversesActionId_ModerationAction_id",
      }),
      ModerationActions: r.many.ModerationAction({
        alias: "ModerationAction_reversesActionId_ModerationAction_id",
      }),
    },
    ModerationCase: {
      ModerationActions: r.many.ModerationAction(),
      Unit_addressedUnitId: r.one.Unit({
        from: r.ModerationCase.addressedUnitId,
        to: r.Unit.id,
        alias: "ModerationCase_addressedUnitId_Unit_id",
      }),
      User_assignedToUserId: r.one.User({
        from: r.ModerationCase.assignedToUserId,
        to: r.User.unitId,
        alias: "ModerationCase_assignedToUserId_User_unitId",
      }),
      ModerationCase_duplicateOfCaseId: r.one.ModerationCase({
        from: r.ModerationCase.duplicateOfCaseId,
        to: r.ModerationCase.id,
        alias: "ModerationCase_duplicateOfCaseId_ModerationCase_id",
      }),
      ModerationCases_duplicateOfCaseId: r.many.ModerationCase({
        alias: "ModerationCase_duplicateOfCaseId_ModerationCase_id",
      }),
      ModerationCase_parentCaseId: r.one.ModerationCase({
        from: r.ModerationCase.parentCaseId,
        to: r.ModerationCase.id,
        alias: "ModerationCase_parentCaseId_ModerationCase_id",
      }),
      ModerationCases_parentCaseId: r.many.ModerationCase({
        alias: "ModerationCase_parentCaseId_ModerationCase_id",
      }),
      Unit_realmUnitId: r.one.Unit({
        from: r.ModerationCase.realmUnitId,
        to: r.Unit.id,
        alias: "ModerationCase_realmUnitId_Unit_id",
      }),
      User_reporterUserId: r.one.User({
        from: r.ModerationCase.reporterUserId,
        to: r.User.unitId,
        alias: "ModerationCase_reporterUserId_User_unitId",
      }),
      Feedback: r.one.Feedback({
        from: r.ModerationCase.sourceFeedbackId,
        to: r.Feedback.id,
      }),
      User_subjectUserId: r.one.User({
        from: r.ModerationCase.subjectUserId,
        to: r.User.unitId,
        alias: "ModerationCase_subjectUserId_User_unitId",
      }),
    },
    StaffAuditLog: {
      User: r.one.User({
        from: r.StaffAuditLog.actorUserId,
        to: r.User.unitId,
      }),
    },
    StaffGrant: {
      User_grantedById: r.one.User({
        from: r.StaffGrant.grantedById,
        to: r.User.unitId,
        alias: "StaffGrant_grantedById_User_unitId",
      }),
      Unit: r.one.Unit({
        from: r.StaffGrant.realmUnitId,
        to: r.Unit.id,
      }),
      User_revokedById: r.one.User({
        from: r.StaffGrant.revokedById,
        to: r.User.unitId,
        alias: "StaffGrant_revokedById_User_unitId",
      }),
      User_userId: r.one.User({
        from: r.StaffGrant.userId,
        to: r.User.unitId,
        alias: "StaffGrant_userId_User_unitId",
      }),
    },
    UnitCollaborator: {
      User_addedById: r.one.User({
        from: r.UnitCollaborator.addedById,
        to: r.User.unitId,
        alias: "UnitCollaborator_addedById_User_unitId",
      }),
      Unit: r.one.Unit({
        from: r.UnitCollaborator.unitId,
        to: r.Unit.id,
      }),
      User_userId: r.one.User({
        from: r.UnitCollaborator.userId,
        to: r.User.unitId,
        alias: "UnitCollaborator_userId_User_unitId",
      }),
    },
  };
}
