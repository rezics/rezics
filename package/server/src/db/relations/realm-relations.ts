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
  };
}
