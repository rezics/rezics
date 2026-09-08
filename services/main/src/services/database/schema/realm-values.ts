import { pgEnum } from "drizzle-orm/pg-core";
import { RealmUnitPublicationStateValues, RealmUnitStatusValues, toEnumValues } from "./contract-values";
export const realmUnitStatus=pgEnum("realm_unit_status",toEnumValues(RealmUnitStatusValues));
export const realmUnitPublicationState=pgEnum("realm_unit_publication_state",toEnumValues(RealmUnitPublicationStateValues));
