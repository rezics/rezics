import type { ServerRelationsBuilder } from "./types";

export function taggingRelations(r: ServerRelationsBuilder) {
  return {
    PolicyTagApplication: {
      PolicyTagRule: r.one.PolicyTagRule({
        from: r.PolicyTagApplication.ruleId,
        to: r.PolicyTagRule.id,
      }),
      Unit: r.one.Unit({
        from: r.PolicyTagApplication.unitId,
        to: r.Unit.id,
      }),
      User_appliedByUserId: r.one.User({
        from: r.PolicyTagApplication.appliedByUserId,
        to: r.User.unitId,
        alias: "PolicyTagApplication_appliedByUserId_User_unitId",
      }),
      User_updatedByUserId: r.one.User({
        from: r.PolicyTagApplication.updatedByUserId,
        to: r.User.unitId,
        alias: "PolicyTagApplication_updatedByUserId_User_unitId",
      }),
    },
    PolicyTagRule: {
      Realm: r.one.Realm({
        from: r.PolicyTagRule.realmUnitId,
        to: r.Realm.unitId,
      }),
      Unit_tagUnitId: r.one.Unit({
        from: r.PolicyTagRule.tagUnitId,
        to: r.Unit.id,
        alias: "PolicyTagRule_tagUnitId_Unit_id",
      }),
      User_createdByUserId: r.one.User({
        from: r.PolicyTagRule.createdByUserId,
        to: r.User.unitId,
        alias: "PolicyTagRule_createdByUserId_User_unitId",
      }),
      User_updatedByUserId: r.one.User({
        from: r.PolicyTagRule.updatedByUserId,
        to: r.User.unitId,
        alias: "PolicyTagRule_updatedByUserId_User_unitId",
      }),
      PolicyTagApplications: r.many.PolicyTagApplication(),
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
  };
}
