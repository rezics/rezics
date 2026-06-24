import { and, eq, inArray, sql } from "drizzle-orm";
import {
  RealmMember,
  Subscription,
  Unit,
  UserSubscriptionListEntry,
} from "../../db/schema";
import { OFFICIAL_ZONE_DEFINITIONS } from "../../db/seed/infra/seed-official-zones";
import { getDefaultRealmId } from "../../infra/default-realm";
import { requireSlugScopeId } from "../../infra/slug-scopes";
import { generateBetween } from "../../shelf/fractional-index";
import { activateSubscriptionListEntryInTx } from "../../subscription/subscription-list-entry.service";

type RegistrationDefaultType = "REALM" | "ZONE";

export type RegistrationDefaultSubscriptionRegistryItem =
  | {
      key: "realm:rezics";
      subscribedType: "REALM";
    }
  | {
      key: `zone:${(typeof OFFICIAL_ZONE_DEFINITIONS)[number]["key"]}`;
      subscribedType: "ZONE";
      slug: (typeof OFFICIAL_ZONE_DEFINITIONS)[number]["slug"];
    };

export const REGISTRATION_DEFAULT_SUBSCRIPTIONS = [
  { key: "realm:rezics", subscribedType: "REALM" },
  ...OFFICIAL_ZONE_DEFINITIONS.map(
    (definition): RegistrationDefaultSubscriptionRegistryItem => ({
      key: `zone:${definition.key}`,
      subscribedType: "ZONE",
      slug: definition.slug,
    }),
  ),
] as const satisfies readonly RegistrationDefaultSubscriptionRegistryItem[];

interface ResolvedRegistrationDefaultSubscription {
  key: string;
  subscribedUnitId: string;
  subscribedType: RegistrationDefaultType;
  position: string;
}

export interface RegistrationDefaultsOptions {
  defaultRealmUnitId?: string | null;
  zoneSlugScopeId?: string;
}

async function resolveRegistrationDefaults(
  dbOrTx: any,
  options: RegistrationDefaultsOptions,
): Promise<ResolvedRegistrationDefaultSubscription[]> {
  const resolved: ResolvedRegistrationDefaultSubscription[] = [];
  let position: string | undefined;
  const nextPosition = () => {
    position = generateBetween(position, undefined);
    return position;
  };

  const defaultRealmUnitId =
    options.defaultRealmUnitId === undefined
      ? getDefaultRealmId()
      : options.defaultRealmUnitId;
  if (defaultRealmUnitId) {
    resolved.push({
      key: "realm:rezics",
      subscribedUnitId: defaultRealmUnitId,
      subscribedType: "REALM",
      position: nextPosition(),
    });
  }

  const zoneDefaults = REGISTRATION_DEFAULT_SUBSCRIPTIONS.filter(
    (
      item,
    ): item is Extract<
      RegistrationDefaultSubscriptionRegistryItem,
      { subscribedType: "ZONE" }
    > => item.subscribedType === "ZONE",
  );
  const zoneSlugScopeId = options.zoneSlugScopeId ?? requireSlugScopeId("zone");
  const zoneRows = await dbOrTx
    .select({ id: Unit.id, slug: Unit.slug, type: Unit.type })
    .from(Unit)
    .where(
      and(
        eq(Unit.slugScope, zoneSlugScopeId),
        inArray(
          Unit.slug,
          zoneDefaults.map((item) => item.slug),
        ),
      ),
    );
  const zoneBySlug = new Map<string, (typeof zoneRows)[number]>();
  for (const row of zoneRows) {
    if (row.slug) zoneBySlug.set(row.slug, row);
  }

  for (const item of zoneDefaults) {
    const zone = zoneBySlug.get(item.slug);
    if (!zone) continue;
    if (zone.type !== "ZONE") {
      throw new Error(
        `Registration default zone slug "${item.slug}" resolved to non-ZONE unit (type=${zone.type})`,
      );
    }
    resolved.push({
      key: item.key,
      subscribedUnitId: zone.id,
      subscribedType: "ZONE",
      position: nextPosition(),
    });
  }

  return resolved;
}

async function ensureDefaultSubscription(
  dbOrTx: any,
  userUnitId: string,
  target: ResolvedRegistrationDefaultSubscription,
) {
  const [existingSubscription] = await dbOrTx
    .select({ id: Subscription.id })
    .from(Subscription)
    .where(
      and(
        eq(Subscription.subscriberUnitId, userUnitId),
        eq(Subscription.subscribedUnitId, target.subscribedUnitId),
      ),
    )
    .limit(1);
  if (!existingSubscription) {
    await dbOrTx.insert(Subscription).values({
      subscriberUnitId: userUnitId,
      subscribedUnitId: target.subscribedUnitId,
      channels: ["*"],
      updatedAt: new Date(),
    });
    await dbOrTx
      .update(Unit)
      .set({
        subscriberCount: sql`${Unit.subscriberCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(Unit.id, target.subscribedUnitId));
  }

  const [existingEntry] = await dbOrTx
    .select({ state: UserSubscriptionListEntry.state })
    .from(UserSubscriptionListEntry)
    .where(
      and(
        eq(UserSubscriptionListEntry.userUnitId, userUnitId),
        eq(UserSubscriptionListEntry.subscribedUnitId, target.subscribedUnitId),
      ),
    )
    .limit(1);
  if (existingEntry?.state === "ACTIVE") return;

  await activateSubscriptionListEntryInTx(dbOrTx, {
    userUnitId,
    subscribedUnitId: target.subscribedUnitId,
    subscribedType: target.subscribedType,
    position: target.position,
  });
}

/**
 * Complete-registration defaults are ordinary subscriptions/list entries.
 * Home is intentionally absent: it is fixed app chrome, not subscription data.
 */
export async function ensureRegistrationDefaultSubscriptions(
  dbOrTx: any,
  userUnitId: string,
  options: RegistrationDefaultsOptions = {},
): Promise<void> {
  const defaults = await resolveRegistrationDefaults(dbOrTx, options);
  for (const target of defaults) {
    if (target.subscribedType === "REALM") {
      await dbOrTx
        .insert(RealmMember)
        .values({
          realmUnitId: target.subscribedUnitId,
          userId: userUnitId,
          roleKey: "member",
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }
    await ensureDefaultSubscription(dbOrTx, userUnitId, target);
  }
}
