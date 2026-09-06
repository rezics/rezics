import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import {
	catalogDateColumns,
	catalogDateConstraint,
	catalogSubtypeColumns,
	catalogSubtypeConstraints,
} from "./catalog-domain-columns";
import { catalogDefinitionRevision, entityIdentity } from "./catalog-identity";
import { referenceArea } from "./catalog-reference";
import {
	createFractionalIndexPositionByteLengthConstraint,
	fractionalIndexPosition,
} from "./columns";

export const publishingWork = pgTable(
	"publishing_work",
	{
		...catalogSubtypeColumns("work"),
	},
	(table) => catalogSubtypeConstraints("publishing_work", "publishing", "work", table),
);

export const publishingTextVersion = pgTable(
	"publishing_text_version",
	{
		...catalogSubtypeColumns("text_version"),
		languageTag: text(),
		methodRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
	},
	(table) => [
		...catalogSubtypeConstraints("publishing_text_version", "publishing", "text_version", table),
		index("publishing_text_method_idx").on(table.methodRevisionId, table.id),
		check(
			"publishing_text_language_check",
			sql`${table.languageTag} is null or octet_length(${table.languageTag}) between 1 and 255`,
		),
	],
);

export const publishingTextWork = pgTable(
	"publishing_text_work",
	{
		textVersionId: uuid()
			.notNull()
			.references(() => publishingTextVersion.id, { onDelete: "restrict" }),
		workId: uuid()
			.notNull()
			.references(() => publishingWork.id, { onDelete: "restrict" }),
		position: bigint({ mode: "number" }).notNull(),
		coverageText: text(),
	},
	(table) => [
		primaryKey({ columns: [table.textVersionId, table.workId] }),
		index("publishing_text_work_reverse_idx").on(table.workId, table.textVersionId),
		index("publishing_text_work_position_idx").on(
			table.textVersionId,
			table.position,
			table.workId,
		),
		check(
			"publishing_text_work_position_check",
			sql`${table.position} between 0 and 9007199254740991`,
		),
	],
);

export const publishingPublication = pgTable(
	"publishing_publication",
	{
		...catalogSubtypeColumns("publication"),
		pageCount: bigint({ mode: "number" }),
		paginationText: text(),
	},
	(table) => [
		...catalogSubtypeConstraints("publishing_publication", "publishing", "publication", table),
		check(
			"publishing_publication_pages_check",
			sql`${table.pageCount} is null or ${table.pageCount} between 0 and 9007199254740991`,
		),
	],
);

export const publishingPublicationText = pgTable(
	"publishing_publication_text",
	{
		publicationId: uuid()
			.notNull()
			.references(() => publishingPublication.id, { onDelete: "restrict" }),
		textVersionId: uuid()
			.notNull()
			.references(() => publishingTextVersion.id, { onDelete: "restrict" }),
		position: bigint({ mode: "number" }).notNull(),
		coverageText: text(),
	},
	(table) => [
		primaryKey({ columns: [table.publicationId, table.textVersionId] }),
		index("publishing_publication_text_reverse_idx").on(table.textVersionId, table.publicationId),
		index("publishing_publication_text_position_idx").on(
			table.publicationId,
			table.position,
			table.textVersionId,
		),
		check(
			"publishing_publication_text_position_check",
			sql`${table.position} between 0 and 9007199254740991`,
		),
	],
);

export const publishingPublicationFacet = pgTable(
	"publishing_publication_facet",
	{
		publicationId: uuid()
			.notNull()
			.references(() => publishingPublication.id, { onDelete: "restrict" }),
		definitionRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
	},
	(table) => [
		primaryKey({ columns: [table.publicationId, table.definitionRevisionId] }),
		index("publishing_publication_facet_reverse_idx").on(
			table.definitionRevisionId,
			table.publicationId,
		),
	],
);

export const publishingReleaseEvent = pgTable(
	"publishing_release_event",
	{
		publicationId: uuid()
			.notNull()
			.references(() => publishingPublication.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		publisherEntityId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
		publisherCredit: text(),
		areaId: uuid().references(() => referenceArea.id, { onDelete: "restrict" }),
		...catalogDateColumns(),
	},
	(table) => [
		primaryKey({ columns: [table.publicationId, table.id] }),
		catalogDateConstraint("publishing_release_event_date_check", table),
		index("publishing_release_event_publisher_idx").on(
			table.publisherEntityId,
			table.publicationId,
			table.id,
		),
		index("publishing_release_event_area_idx").on(table.areaId, table.publicationId, table.id),
	],
);

export const publishingSerialization = pgTable(
	"publishing_serialization",
	{
		...catalogSubtypeColumns("serialization"),
		textVersionId: uuid().references(() => publishingTextVersion.id, { onDelete: "restrict" }),
		statusRevisionId: uuid().references(() => catalogDefinitionRevision.id, {
			onDelete: "restrict",
		}),
	},
	(table) => [
		...catalogSubtypeConstraints("publishing_serialization", "publishing", "serialization", table),
		index("publishing_serialization_text_idx").on(table.textVersionId, table.id),
		index("publishing_serialization_status_idx").on(table.statusRevisionId, table.id),
	],
);

export const publishingInstallment = pgTable(
	"publishing_installment",
	{
		serializationId: uuid()
			.notNull()
			.references(() => publishingSerialization.id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		parentId: uuid(),
		position: fractionalIndexPosition().notNull(),
		label: text(),
		kindRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		...catalogDateColumns(),
	},
	(table) => [
		primaryKey({ columns: [table.serializationId, table.id] }),
		index("publishing_installment_parent_idx").on(
			table.serializationId,
			table.parentId,
			table.position,
			table.id,
		),
		index("publishing_installment_kind_idx").on(
			table.kindRevisionId,
			table.serializationId,
			table.id,
		),
		foreignKey({
			name: "publishing_installment_parent_fk",
			columns: [table.serializationId, table.parentId],
			foreignColumns: [table.serializationId, table.id],
		}).onDelete("restrict"),
		createFractionalIndexPositionByteLengthConstraint(
			"publishing_installment_position_check",
			table.position,
		),
		check(
			"publishing_installment_parent_check",
			sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
		),
		catalogDateConstraint("publishing_installment_date_check", table),
	],
);
