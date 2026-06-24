"use client";
import { mockRealm, mockRealms } from "@/__cosmos__/mock-data";
import { Realm } from "@rezics/backend/api";
import { RealmCard } from "./RealmCard";

function toRealm(mock: ReturnType<typeof mockRealm>): Realm {
  return new Realm(mock);
}

export default {
  Default: (
    <div className="p-4 max-w-sm">
      <RealmCard realm={toRealm(mockRealm())} />
    </div>
  ),

  LongName: (
    <div className="p-4 max-w-sm">
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
    <div className="p-4 max-w-sm">
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
    <div className="p-4 max-w-sm flex flex-col gap-2">
      {mockRealms().map((r) => (
        <RealmCard key={r.id} realm={toRealm(r)} />
      ))}
    </div>
  ),
};
