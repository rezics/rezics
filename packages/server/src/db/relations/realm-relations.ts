import type { ServerRelationsBuilder } from "./types";

export function realmRelations(r: ServerRelationsBuilder) {
  return {
    Realm: {
      Unit: r.one.Unit({
        from: r.Realm.unitId,
        to: r.Unit.id,
      }),
      RealmCapabilityGrants: r.many.RealmCapabilityGrant(),
      RealmMembers: r.many.RealmMember(),
      RealmRuleAcknowledgements: r.many.RealmRuleAcknowledgement(),
      RealmRulePolicies: r.many.RealmRulePolicy(),
      RealmTagTree: r.one.RealmTagTree(),
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
        from: [
          r.RealmCapabilityGrant.realmUnitId,
          r.RealmCapabilityGrant.userId,
        ],
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
      RealmRulePolicy: r.one.RealmRulePolicy({
        from: r.RealmRuleAcknowledgement.policyId,
        to: r.RealmRulePolicy.id,
      }),
      RealmRuleRevision: r.one.RealmRuleRevision({
        from: r.RealmRuleAcknowledgement.revisionId,
        to: r.RealmRuleRevision.id,
      }),
      User: r.one.User({
        from: r.RealmRuleAcknowledgement.userId,
        to: r.User.unitId,
      }),
    },
    RealmRulePolicy: {
      Realm: r.one.Realm({
        from: r.RealmRulePolicy.realmUnitId,
        to: r.Realm.unitId,
      }),
      RealmRuleRevisions: r.many.RealmRuleRevision(),
      RealmRuleItems: r.many.RealmRuleItem(),
      RealmRuleAcknowledgements: r.many.RealmRuleAcknowledgement(),
    },
    RealmRuleRevision: {
      RealmRulePolicy: r.one.RealmRulePolicy({
        from: r.RealmRuleRevision.policyId,
        to: r.RealmRulePolicy.id,
      }),
      User_createdByUserId: r.one.User({
        from: r.RealmRuleRevision.createdByUserId,
        to: r.User.unitId,
        alias: "RealmRuleRevision_createdByUserId_User_unitId",
      }),
      RealmRuleItems: r.many.RealmRuleItem(),
      RealmRuleAcknowledgements: r.many.RealmRuleAcknowledgement(),
    },
    RealmRuleItem: {
      RealmRulePolicy: r.one.RealmRulePolicy({
        from: r.RealmRuleItem.policyId,
        to: r.RealmRulePolicy.id,
      }),
      RealmRuleRevision: r.one.RealmRuleRevision({
        from: r.RealmRuleItem.revisionId,
        to: r.RealmRuleRevision.id,
      }),
      Unit_rulePostUnitId: r.one.Unit({
        from: r.RealmRuleItem.rulePostUnitId,
        to: r.Unit.id,
        alias: "RealmRuleItem_rulePostUnitId_Unit_id",
      }),
      Unit_reportReasonUnitId: r.one.Unit({
        from: r.RealmRuleItem.reportReasonUnitId,
        to: r.Unit.id,
        alias: "RealmRuleItem_reportReasonUnitId_Unit_id",
      }),
    },
    RealmTagTree: {
      Realm: r.one.Realm({
        from: r.RealmTagTree.realmUnitId,
        to: r.Realm.unitId,
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
  };
}
