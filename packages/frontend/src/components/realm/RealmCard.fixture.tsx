"use client";
import { mockRealm, mockRealms } from "@/__cosmos__/mock-data";
import type { Realm } from "@rezics/backend/api";
import { RealmCard } from "./RealmCard";

function toRealm(mock: ReturnType<typeof mockRealm>): Realm {
  return mock;
}

export default {
  Default: (
    <div className="mx-auto w-full max-w-sm p-4">
      <RealmCard realm={toRealm(mockRealm())} />
    </div>
  ),

  LongName: (
    <div className="mx-auto w-full max-w-sm p-4">
      <RealmCard
        realm={toRealm(
          mockRealm({
            id: "realm-long",
            slug: "very-long-realm-name-for-testing",
            name: "这是一个名字非常非常非常长的社区用于测试截断效果",
          }),
        )}
      />
    </div>
  ),

  ShortName: (
    <div className="mx-auto w-full max-w-sm p-4">
      <RealmCard
        realm={toRealm(
          mockRealm({
            id: "realm-short",
            slug: "r",
            name: "R",
          }),
        )}
      />
    </div>
  ),

  List: (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-2 p-4">
      {mockRealms().map((r) => (
        <RealmCard key={r.id} realm={toRealm(r)} />
      ))}
    </div>
  ),

  MobileDenseList: (
    <div className="mx-auto flex w-full max-w-[320px] flex-col gap-2 p-2">
      {mockRealms().map((r) => (
        <RealmCard key={r.id} realm={toRealm(r)} />
      ))}
    </div>
  ),

  OverflowName: (
    <div className="mx-auto w-full max-w-[320px] p-2">
      <RealmCard
        realm={toRealm(
          mockRealm({
            id: "realm-overflow",
            slug: "overflow",
            name: "RealmWithOneExtremelyLongUnbrokenIdentifierThatMustWrapAnywhereWithoutHorizontalScroll",
          }),
        )}
      />
    </div>
  ),
};
