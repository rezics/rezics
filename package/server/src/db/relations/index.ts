import { defineRelations } from "drizzle-orm";
import * as schema from "../schema/schema";

export const relations = defineRelations(schema, (r) => ({
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
    Units_via_UserUnitCollection: r.many.Unit({
      alias: "Unit_id_User_unitId_via_UserUnitCollection",
    }),
    UserUnitProgresses: r.many.UserUnitProgress(),
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
  ApiToken: {
    User: r.one.User({
      from: r.ApiToken.userId,
      to: r.User.unitId,
    }),
  },
  Book: {
    Unit: r.one.Unit({
      from: r.Book.unitId,
      to: r.Unit.id,
    }),
  },
  Unit: {
    Books: r.many.Book(),
    Comments_realmUnitId: r.many.Comment({
      alias: "Comment_realmUnitId_Unit_id",
    }),
    Comments_rootUnitId: r.many.Comment({
      alias: "Comment_rootUnitId_Unit_id",
    }),
    Comments_via_CommentPromotion: r.many.Comment({
      alias: "Comment_id_Unit_id_via_CommentPromotion",
    }),
    ContentStructures: r.many.ContentStructure(),
    ContentStructureAnchors: r.many.ContentStructureAnchor(),
    ContentStructureNodes: r.many.ContentStructureNode(),
    ContentTranslations: r.many.ContentTranslation(),
    Entities: r.many.Entity(),
    Games: r.many.Game(),
    GameSystemRequirements: r.many.GameSystemRequirement(),
    HistoryOutboxes: r.many.HistoryOutbox(),
    Links: r.many.Link(),
    Media: r.many.Media(),
    ModerationActions: r.many.ModerationAction(),
    ModerationCases_addressedUnitId: r.many.ModerationCase({
      alias: "ModerationCase_addressedUnitId_Unit_id",
    }),
    ModerationCases_realmUnitId: r.many.ModerationCase({
      alias: "ModerationCase_realmUnitId_Unit_id",
    }),
    Polls_unitId: r.many.Poll({
      alias: "Poll_unitId_Unit_id",
    }),
    Polls_via_PollOption: r.many.Poll({
      alias: "Poll_unitId_Unit_id_via_PollOption",
    }),
    ScoreEntries: r.many.ScoreEntry(),
    Realms: r.many.Realm(),
    RealmRuleAcknowledgements: r.many.RealmRuleAcknowledgement(),
    RealmTagApplications_tagUnitId: r.many.RealmTagApplication({
      alias: "RealmTagApplication_tagUnitId_Unit_id",
    }),
    RealmTagApplications_unitId: r.many.RealmTagApplication({
      alias: "RealmTagApplication_unitId_Unit_id",
    }),
    RealmTagContexts_contextUnitId: r.one.RealmTagContext({
      alias: "RealmTagContext_contextUnitId_Unit_id",
    }),
    RealmTagContexts_tagUnitId: r.many.RealmTagContext({
      alias: "RealmTagContext_tagUnitId_Unit_id",
    }),
    Series: r.many.Series(),
    SeriesContentIndices: r.many.SeriesContentIndex(),
    Shelves: r.many.Shelf(),
    StaffGrants: r.many.StaffGrant(),
    Users_via_Unit: r.many.User({
      from: r.Unit.id.through(r.Unit.targetUnitId),
      to: r.User.unitId.through(r.Unit.userId),
      alias: "Unit_id_User_unitId_via_Unit",
    }),
    UnitAliases: r.many.UnitAlias(),
    UnitCollaborators: r.many.UnitCollaborator(),
    SourceSites: r.many.SourceSite(),
    Users_via_UnitFieldLock: r.many.User({
      alias: "User_unitId_Unit_id_via_UnitFieldLock",
    }),
    UnitHistoryClocks: r.many.UnitHistoryClock(),
    UnitSupportLanguages: r.many.UnitSupportLanguage(),
    UnitTranslations: r.many.UnitTranslation(),
    UserTagApplications_tagUnitId: r.many.UserTagApplication({
      alias: "UserTagApplication_tagUnitId_Unit_id",
    }),
    UserTagApplications_unitId: r.many.UserTagApplication({
      alias: "UserTagApplication_unitId_Unit_id",
    }),
    Users_via_UserUnitCollection: r.many.User({
      from: r.Unit.id.through(r.UserUnitCollection.unitId),
      to: r.User.unitId.through(r.UserUnitCollection.userId),
      alias: "Unit_id_User_unitId_via_UserUnitCollection",
    }),
    UserUnitProgresses: r.many.UserUnitProgress(),
    Zones: r.many.Zone(),
  },
  Comment: {
    User: r.one.User({
      from: r.Comment.authorUserId,
      to: r.User.unitId,
    }),
    Comment: r.one.Comment({
      from: r.Comment.parentCommentId,
      to: r.Comment.id,
      alias: "Comment_parentCommentId_Comment_id",
    }),
    Comments: r.many.Comment({
      alias: "Comment_parentCommentId_Comment_id",
    }),
    Unit_realmUnitId: r.one.Unit({
      from: r.Comment.realmUnitId,
      to: r.Unit.id,
      alias: "Comment_realmUnitId_Unit_id",
    }),
    Unit_rootUnitId: r.one.Unit({
      from: r.Comment.rootUnitId,
      to: r.Unit.id,
      alias: "Comment_rootUnitId_Unit_id",
    }),
    Units: r.many.Unit({
      from: r.Comment.id.through(r.CommentPromotion.commentId),
      to: r.Unit.id.through(r.CommentPromotion.scopeUnitId),
      alias: "Comment_id_Unit_id_via_CommentPromotion",
    }),
  },
  ContentStructure: {
    Unit: r.one.Unit({
      from: r.ContentStructure.ownerUnitId,
      to: r.Unit.id,
    }),
    ContentStructureAnchors: r.many.ContentStructureAnchor(),
    ContentStructureNodes: r.many.ContentStructureNode(),
  },
  ContentStructureAnchor: {
    Unit: r.one.Unit({
      from: r.ContentStructureAnchor.contentUnitId,
      to: r.Unit.id,
    }),
    ContentStructureNode: r.one.ContentStructureNode({
      from: r.ContentStructureAnchor.nodeId,
      to: r.ContentStructureNode.id,
    }),
    ContentStructure: r.one.ContentStructure({
      from: r.ContentStructureAnchor.ownerUnitId,
      to: r.ContentStructure.ownerUnitId,
    }),
  },
  ContentStructureNode: {
    ContentStructureAnchors: r.many.ContentStructureAnchor(),
    Unit: r.one.Unit({
      from: r.ContentStructureNode.contentUnitId,
      to: r.Unit.id,
    }),
    ContentStructure: r.one.ContentStructure({
      from: r.ContentStructureNode.ownerUnitId,
      to: r.ContentStructure.ownerUnitId,
    }),
    ContentStructureNode: r.one.ContentStructureNode({
      from: r.ContentStructureNode.parentId,
      to: r.ContentStructureNode.id,
      alias: "ContentStructureNode_parentId_ContentStructureNode_id",
    }),
    ContentStructureNodes: r.many.ContentStructureNode({
      alias: "ContentStructureNode_parentId_ContentStructureNode_id",
    }),
    SeriesContentIndices: r.one.SeriesContentIndex(),
    Users: r.many.User({
      from: r.ContentStructureNode.id.through(r.UserContentNodeProgress.nodeId),
      to: r.User.unitId.through(r.UserContentNodeProgress.userId),
    }),
    UserUnitProgresses: r.many.UserUnitProgress(),
  },
  ContentTranslation: {
    Unit: r.one.Unit({
      from: r.ContentTranslation.unitId,
      to: r.Unit.id,
    }),
  },
  UnitExternalRef: {
    CreditAttributions: r.many.CreditAttribution({
      from: r.UnitExternalRef.id.through(
        r.CreditAttributionEvidence.sourceRefId,
      ),
      to: [
        r.CreditAttribution.unitId.through(r.CreditAttributionEvidence.unitId),
        r.CreditAttribution.entityId.through(
          r.CreditAttributionEvidence.entityId,
        ),
        r.CreditAttribution.role.through(r.CreditAttributionEvidence.role),
      ],
    }),
    GameSystemRequirements: r.many.GameSystemRequirement(),
  },
  CreditAttribution: {
    UnitExternalRefs: r.many.UnitExternalRef(),
  },
  Entity: {
    Unit: r.one.Unit({
      from: r.Entity.unitId,
      to: r.Unit.id,
    }),
    SourceSites: r.many.SourceSite(),
  },
  Game: {
    Unit: r.one.Unit({
      from: r.Game.unitId,
      to: r.Unit.id,
    }),
    GameSystemRequirements: r.many.GameSystemRequirement(),
  },
  GameSystemRequirement: {
    Game: r.one.Game({
      from: r.GameSystemRequirement.gameUnitId,
      to: r.Game.unitId,
    }),
    Unit: r.one.Unit({
      from: r.GameSystemRequirement.platformEntityId,
      to: r.Unit.id,
    }),
    UnitExternalRef: r.one.UnitExternalRef({
      from: r.GameSystemRequirement.sourceRefId,
      to: r.UnitExternalRef.id,
    }),
  },
  HistoryOutbox: {
    User_actorUserId: r.one.User({
      from: r.HistoryOutbox.actorUserId,
      to: r.User.unitId,
      alias: "HistoryOutbox_actorUserId_User_unitId",
    }),
    User_processedById: r.one.User({
      from: r.HistoryOutbox.processedById,
      to: r.User.unitId,
      alias: "HistoryOutbox_processedById_User_unitId",
    }),
    Unit: r.one.Unit({
      from: r.HistoryOutbox.unitId,
      to: r.Unit.id,
    }),
  },
  Jwks: {
    JwtService: r.one.JwtService({
      from: r.Jwks.jwtServiceId,
      to: r.JwtService.id,
    }),
  },
  JwtService: {
    Jwks: r.many.Jwks(),
  },
  Link: {
    Unit: r.one.Unit({
      from: r.Link.unitId,
      to: r.Unit.id,
    }),
  },
  Media: {
    Unit: r.one.Unit({
      from: r.Media.unitId,
      to: r.Unit.id,
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
  Feedback: {
    ModerationCases: r.many.ModerationCase(),
  },
  Poll: {
    Unit: r.one.Unit({
      from: r.Poll.unitId,
      to: r.Unit.id,
      alias: "Poll_unitId_Unit_id",
    }),
    Units: r.many.Unit({
      from: r.Poll.unitId.through(r.PollOption.pollUnitId),
      to: r.Unit.id.through(r.PollOption.unitId),
      alias: "Poll_unitId_Unit_id_via_PollOption",
    }),
    PollOptions: r.many.PollOption({
      from: r.Poll.unitId.through(r.PollVote.pollUnitId),
      to: [
        r.PollOption.pollUnitId.through(r.PollVote.pollUnitId),
        r.PollOption.optionId.through(r.PollVote.optionId),
      ],
    }),
  },
  PollOption: {
    Polls: r.many.Poll(),
  },
  ScoreEntry: {
    Units: r.many.Unit({
      from: r.ScoreEntry.id.through(r.Post.scoreEntryId),
      to: r.Unit.id.through(r.Post.unitId),
    }),
  },
  Realm: {
    Unit: r.one.Unit({
      from: r.Realm.unitId,
      to: r.Unit.id,
    }),
    RealmCapabilityGrants: r.many.RealmCapabilityGrant(),
    RealmMembers: r.many.RealmMember(),
    RealmRuleAcknowledgements: r.many.RealmRuleAcknowledgement(),
    RealmTagApplications: r.many.RealmTagApplication(),
    RealmTagContexts: r.many.RealmTagContext(),
  },
  RealmCapabilityGrant: {
    User_grantedById: r.one.User({
      from: r.RealmCapabilityGrant.grantedById,
      to: r.User.unitId,
      alias: "RealmCapabilityGrant_grantedById_User_unitId",
    }),
    Realm: r.one.Realm({
      from: r.RealmCapabilityGrant.realmUnitId,
      to: r.Realm.unitId,
    }),
    RealmMember: r.one.RealmMember({
      from: [r.RealmCapabilityGrant.realmUnitId, r.RealmCapabilityGrant.userId],
      to: [r.RealmMember.realmUnitId, r.RealmMember.userId],
    }),
    User_revokedById: r.one.User({
      from: r.RealmCapabilityGrant.revokedById,
      to: r.User.unitId,
      alias: "RealmCapabilityGrant_revokedById_User_unitId",
    }),
  },
  RealmMember: {
    RealmCapabilityGrants: r.many.RealmCapabilityGrant(),
    Realm: r.one.Realm({
      from: r.RealmMember.realmUnitId,
      to: r.Realm.unitId,
    }),
  },
  RealmRuleAcknowledgement: {
    Realm: r.one.Realm({
      from: r.RealmRuleAcknowledgement.realmUnitId,
      to: r.Realm.unitId,
    }),
    Unit: r.one.Unit({
      from: r.RealmRuleAcknowledgement.ruleUnitId,
      to: r.Unit.id,
    }),
    User: r.one.User({
      from: r.RealmRuleAcknowledgement.userId,
      to: r.User.unitId,
    }),
  },
  RealmTagApplication: {
    Realm: r.one.Realm({
      from: r.RealmTagApplication.realmUnitId,
      to: r.Realm.unitId,
    }),
    Unit_tagUnitId: r.one.Unit({
      from: r.RealmTagApplication.tagUnitId,
      to: r.Unit.id,
      alias: "RealmTagApplication_tagUnitId_Unit_id",
    }),
    Unit_unitId: r.one.Unit({
      from: r.RealmTagApplication.unitId,
      to: r.Unit.id,
      alias: "RealmTagApplication_unitId_Unit_id",
    }),
    RealmTagApplicationVotes: r.many.RealmTagApplicationVote(),
  },
  RealmTagApplicationVote: {
    RealmTagApplication: r.one.RealmTagApplication({
      from: [
        r.RealmTagApplicationVote.realmUnitId,
        r.RealmTagApplicationVote.tagUnitId,
        r.RealmTagApplicationVote.unitId,
      ],
      to: [
        r.RealmTagApplication.realmUnitId,
        r.RealmTagApplication.tagUnitId,
        r.RealmTagApplication.unitId,
      ],
    }),
  },
  RealmTagContext: {
    Unit_contextUnitId: r.one.Unit({
      from: r.RealmTagContext.contextUnitId,
      to: r.Unit.id,
      alias: "RealmTagContext_contextUnitId_Unit_id",
    }),
    Realm: r.one.Realm({
      from: r.RealmTagContext.realmUnitId,
      to: r.Realm.unitId,
    }),
    Unit_tagUnitId: r.one.Unit({
      from: r.RealmTagContext.tagUnitId,
      to: r.Unit.id,
      alias: "RealmTagContext_tagUnitId_Unit_id",
    }),
  },
  Series: {
    Unit: r.one.Unit({
      from: r.Series.unitId,
      to: r.Unit.id,
    }),
    SeriesContentIndices: r.many.SeriesContentIndex(),
  },
  SeriesContentIndex: {
    ContentStructureNode: r.one.ContentStructureNode({
      from: r.SeriesContentIndex.contentNodeId,
      to: r.ContentStructureNode.id,
    }),
    Unit: r.one.Unit({
      from: r.SeriesContentIndex.releaseUnitId,
      to: r.Unit.id,
    }),
    Series: r.one.Series({
      from: r.SeriesContentIndex.seriesUnitId,
      to: r.Series.unitId,
    }),
  },
  Shelf: {
    Unit: r.one.Unit({
      from: r.Shelf.unitId,
      to: r.Unit.id,
    }),
    ShelfUnits: r.many.ShelfUnit(),
    ShelfUnitRelations: r.many.ShelfUnitRelation(),
  },
  ShelfUnit: {
    Shelf: r.one.Shelf({
      from: r.ShelfUnit.shelfId,
      to: r.Shelf.unitId,
    }),
    ShelfUnitRelations_shelfId_childUnitId: r.many.ShelfUnitRelation({
      alias: "ShelfUnitRelation_shelfId_childUnitId_ShelfUnit_shelfId_unitId",
    }),
    ShelfUnitRelations_shelfId_parentUnitId: r.many.ShelfUnitRelation({
      alias: "ShelfUnitRelation_shelfId_parentUnitId_ShelfUnit_shelfId_unitId",
    }),
  },
  ShelfUnitRelation: {
    ShelfUnit_shelfId_childUnitId: r.one.ShelfUnit({
      from: [r.ShelfUnitRelation.shelfId, r.ShelfUnitRelation.childUnitId],
      to: [r.ShelfUnit.shelfId, r.ShelfUnit.unitId],
      alias: "ShelfUnitRelation_shelfId_childUnitId_ShelfUnit_shelfId_unitId",
    }),
    Shelf: r.one.Shelf({
      from: r.ShelfUnitRelation.shelfId,
      to: r.Shelf.unitId,
    }),
    ShelfUnit_shelfId_parentUnitId: r.one.ShelfUnit({
      from: [r.ShelfUnitRelation.shelfId, r.ShelfUnitRelation.parentUnitId],
      to: [r.ShelfUnit.shelfId, r.ShelfUnit.unitId],
      alias: "ShelfUnitRelation_shelfId_parentUnitId_ShelfUnit_shelfId_unitId",
    }),
  },
  SourceSite: {
    Entity: r.one.Entity({
      from: r.SourceSite.entityUnitId,
      to: r.Entity.unitId,
    }),
    Units: r.many.Unit({
      from: r.SourceSite.entityUnitId.through(
        r.UnitExternalRef.sourceSiteEntityUnitId,
      ),
      to: r.Unit.id.through(r.UnitExternalRef.unitId),
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
  UnitAlias: {
    User_createdById: r.one.User({
      from: r.UnitAlias.createdById,
      to: r.User.unitId,
      alias: "UnitAlias_createdById_User_unitId",
    }),
    Unit: r.one.Unit({
      from: r.UnitAlias.unitId,
      to: r.Unit.id,
    }),
    User_updatedById: r.one.User({
      from: r.UnitAlias.updatedById,
      to: r.User.unitId,
      alias: "UnitAlias_updatedById_User_unitId",
    }),
    Users: r.many.User({
      from: r.UnitAlias.id.through(r.UnitAliasVote.aliasId),
      to: r.User.unitId.through(r.UnitAliasVote.userId),
      alias: "UnitAlias_id_User_unitId_via_UnitAliasVote",
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
  UnitHistoryClock: {
    Unit: r.one.Unit({
      from: r.UnitHistoryClock.unitId,
      to: r.Unit.id,
    }),
  },
  UnitSupportLanguage: {
    Unit: r.one.Unit({
      from: r.UnitSupportLanguage.unitId,
      to: r.Unit.id,
    }),
  },
  UnitTranslation: {
    Unit: r.one.Unit({
      from: r.UnitTranslation.unitId,
      to: r.Unit.id,
    }),
  },
  UserTagApplication: {
    Unit_tagUnitId: r.one.Unit({
      from: r.UserTagApplication.tagUnitId,
      to: r.Unit.id,
      alias: "UserTagApplication_tagUnitId_Unit_id",
    }),
    Unit_unitId: r.one.Unit({
      from: r.UserTagApplication.unitId,
      to: r.Unit.id,
      alias: "UserTagApplication_unitId_Unit_id",
    }),
    User: r.one.User({
      from: r.UserTagApplication.userId,
      to: r.User.unitId,
    }),
  },
  UserUnitProgress: {
    ContentStructureNode: r.one.ContentStructureNode({
      from: r.UserUnitProgress.lastReadNodeId,
      to: r.ContentStructureNode.id,
    }),
    Unit: r.one.Unit({
      from: r.UserUnitProgress.unitId,
      to: r.Unit.id,
    }),
    User: r.one.User({
      from: r.UserUnitProgress.userId,
      to: r.User.unitId,
    }),
  },
  Zone: {
    Unit: r.one.Unit({
      from: r.Zone.unitId,
      to: r.Unit.id,
    }),
  },
}));
