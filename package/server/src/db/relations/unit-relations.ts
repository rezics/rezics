import type { ServerRelationsBuilder } from "./types";

export function unitRelations(r: ServerRelationsBuilder) {
  return {
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
      RealmRuleItems_rulePostUnitId: r.many.RealmRuleItem({
        alias: "RealmRuleItem_rulePostUnitId_Unit_id",
      }),
      RealmRuleItems_reportReasonUnitId: r.many.RealmRuleItem({
        alias: "RealmRuleItem_reportReasonUnitId_Unit_id",
      }),
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
      UnitExternalLinks: r.many.UnitExternalLink({
        alias: "UnitExternalLink_unitId_Unit_id",
      }),
      UnitExternalLinks_asLabel: r.many.UnitExternalLink({
        alias: "UnitExternalLink_labelUnitId_Unit_id",
      }),
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
      UserUnitProgresses: r.many.UserUnitProgress(),
      Zones: r.many.Zone(),
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
  };
}
