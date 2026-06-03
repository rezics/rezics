-- Realm feed publication is separate from moderation visibility.
CREATE TYPE "RealmFeedPublicationState" AS ENUM (
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'REMOVED'
);

ALTER TABLE "Realm"
    ADD COLUMN "contentRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "UnitRealm"
    ALTER COLUMN "state" DROP DEFAULT;

ALTER TABLE "UnitRealm"
    ALTER COLUMN "state" TYPE "RealmFeedPublicationState"
    USING CASE "state"
        WHEN 'VISIBLE'::"ContentModerationStateKind" THEN 'APPROVED'::"RealmFeedPublicationState"
        WHEN 'REMOVED'::"ContentModerationStateKind" THEN 'REMOVED'::"RealmFeedPublicationState"
        ELSE 'APPROVED'::"RealmFeedPublicationState"
    END;

ALTER TABLE "UnitRealm"
    ALTER COLUMN "state" SET DEFAULT 'APPROVED';
