import type React from "react";

interface RealmMemberListProps {
  realmId: string;
}

export const RealmMemberList: React.FC<RealmMemberListProps> = ({
  realmId: _realmId,
}) => {
  // MOCK: member list not yet available via dedicated endpoint - show placeholder
  return (
    <div className="py-4">
      <p className="text-sm text-text-secondary">
        Member list will be available when the members API endpoint is
        implemented.
      </p>
    </div>
  );
};
