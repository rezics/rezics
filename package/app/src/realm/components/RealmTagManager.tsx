import type React from "react";

interface RealmTagManagerProps {
  realmId: string;
}

export const RealmTagManager: React.FC<RealmTagManagerProps> = ({
  realmId: _realmId,
}) => {
  // MOCK: tag management UI placeholder
  return (
    <div className="py-4">
      <p className="text-sm text-text-secondary">
        Tag management will be available when the realm-tag API endpoints are
        wired up.
      </p>
    </div>
  );
};
