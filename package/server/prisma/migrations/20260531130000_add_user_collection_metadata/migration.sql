CREATE TABLE "UserUnitCollection" (
    "userId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "searchText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserUnitCollection_pkey" PRIMARY KEY ("userId","unitId")
);

CREATE INDEX "UserUnitCollection_userId_updatedAt_idx"
    ON "UserUnitCollection"("userId", "updatedAt");

CREATE INDEX "UserUnitCollection_unitId_idx"
    ON "UserUnitCollection"("unitId");

CREATE TABLE "UserTagApplication" (
    "userId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "tagUnitId" UUID NOT NULL,
    "position" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTagApplication_pkey" PRIMARY KEY ("userId","unitId","tagUnitId")
);

CREATE INDEX "UserTagApplication_userId_unitId_idx"
    ON "UserTagApplication"("userId", "unitId");

CREATE INDEX "UserTagApplication_userId_tagUnitId_unitId_idx"
    ON "UserTagApplication"("userId", "tagUnitId", "unitId");

CREATE INDEX "UserTagApplication_userId_unitId_position_idx"
    ON "UserTagApplication"("userId", "unitId", "position");

ALTER TABLE "UserUnitCollection"
    ADD CONSTRAINT "UserUnitCollection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("unitId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserUnitCollection"
    ADD CONSTRAINT "UserUnitCollection_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTagApplication"
    ADD CONSTRAINT "UserTagApplication_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("unitId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTagApplication"
    ADD CONSTRAINT "UserTagApplication_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTagApplication"
    ADD CONSTRAINT "UserTagApplication_tagUnitId_fkey"
    FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
