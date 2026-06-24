import type { RealmDTO } from "@rezics/contract";
import type React from "react";
import { RealmCard } from "./RealmCard";

interface RealmListProps {
  realms: RealmDTO[];
}

export const RealmList: React.FC<RealmListProps> = ({ realms }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {realms.map((realm) => (
        <RealmCard key={realm.unitId} realm={realm} />
      ))}
    </div>
  );
};
