import { expect, it } from "vitest";
import { applicationModel } from "../generated/model";
import { candidateProfiles, requireModelWriter, validateModelRecord, verifyModel } from "./runtime";
import { validateDatatype, XsdNamespace } from "./datatypes";
import { schemaId } from "../identity";
const id = (key: string) => schemaId("model-fixture", key);
const xsd = (name: string, value: string) => validateDatatype(XsdNamespace + name, value).status;
it("validates exact integer and decimal spaces without floating-point coercion", () => {
	expect(xsd("integer", "900719925474099312345678901234567890")).toBe("valid");
	expect(xsd("int", "-2147483648")).toBe("valid");
	expect(xsd("int", "2147483647")).toBe("valid");
	expect(xsd("int", "-2147483649")).toBe("invalid");
	expect(xsd("int", "2147483648")).toBe("invalid");
	expect(xsd("unsignedLong", "18446744073709551615")).toBe("valid");
	expect(xsd("unsignedLong", "18446744073709551616")).toBe("invalid");
	expect(xsd("decimal", "-0.0000000000000000000000000000000000001")).toBe("valid");
	for (const value of ["++1", "--1", "+-1", "1e3", "1 2"])
		expect(xsd("decimal", value)).toBe("invalid");
	expect(xsd("positiveInteger", "0")).toBe("invalid");
	expect(xsd("integer", " \t+00012\n")).toBe("valid");
});
it("checks calendar days, timezones, partial dates and exact duration syntax", () => {
	expect(xsd("date", "2024-02-29")).toBe("valid");
	expect(xsd("date", "2023-02-29")).toBe("invalid");
	expect(xsd("date", "1900-02-29")).toBe("invalid");
	expect(xsd("date", "2000-02-29")).toBe("valid");
	expect(xsd("dateTime", "2026-09-18T24:00:00Z")).toBe("valid");
	expect(xsd("dateTime", "2026-09-18T24:00:00.1Z")).toBe("invalid");
	expect(xsd("dateTime", "2026-09-18T12:30:59.1234567890123456789+14:00")).toBe("valid");
	expect(xsd("dateTime", "2026-09-18T12:30:59a1Z")).toBe("invalid");
	expect(xsd("dateTime", "2026-09-18T12:30:59+14:01")).toBe("invalid");
	expect(xsd("dateTimeStamp", "2026-09-18T12:00:00")).toBe("invalid");
	expect(xsd("gDay", "---31Z")).toBe("valid");
	expect(xsd("gDay", "31")).toBe("invalid");
	expect(xsd("gMonthDay", "--02-29")).toBe("valid");
	expect(xsd("duration", "P1Y2M3DT4H5M6.0001S")).toBe("valid");
	expect(xsd("duration", "P")).toBe("invalid");
	expect(xsd("duration", "P1YT")).toBe("invalid");
	expect(xsd("yearMonthDuration", "P1Y2M")).toBe("valid");
	expect(xsd("yearMonthDuration", "P1D")).toBe("invalid");
});
it("keeps unsupported types explicit and validates language/binary forms", () => {
	expect(validateDatatype("https://example.test/custom", "opaque").status).toBe("unsupported");
	expect(xsd("QName", "x:item")).toBe("unsupported");
	expect(xsd("boolean", "TRUE")).toBe("invalid");
	expect(xsd("hexBinary", "a0FF")).toBe("valid");
	expect(xsd("hexBinary", "f")).toBe("invalid");
	expect(xsd("base64Binary", "YQ==")).toBe("valid");
	expect(xsd("base64Binary", "YR==")).toBe("invalid");
	expect(
		validateDatatype("http://www.w3.org/1999/02/22-rdf-syntax-ns#langString", "書籍", "zh-Hant")
			.status,
	).toBe("valid");
	expect(
		validateDatatype("http://www.w3.org/1999/02/22-rdf-syntax-ns#langString", "Book").status,
	).toBe("invalid");
});
it("requires an explicit Book grain and one named writer", () => {
	const book = applicationModel.profiles.find((profile) => profile.key === "book-work")!;
	expect(
		candidateProfiles(applicationModel, [book.types[0]!.termId]).map((profile) => profile.key),
	).toEqual(expect.arrayContaining(["book-work", "publication"]));
	const author = book.properties.find((rule) => rule.iri === "https://schema.org/author")!;
	expect(() =>
		requireModelWriter(applicationModel, "book-work", author.predicateId, "semantic.relations"),
	).toThrow(/another native writer/);
	expect(
		requireModelWriter(applicationModel, "book-work", author.predicateId, "catalog.relations")
			.storage.table,
	).toBe("publishing_relation_participant");
	const corrupt = structuredClone(applicationModel);
	corrupt.profiles[0]!.grain = "forged";
	expect(() => verifyModel(corrupt)).toThrow(/identity/);
});
it("enforces preferred-label language uniqueness and marks unreviewed data as descriptive", () => {
	const concept = applicationModel.profiles.find((profile) => profile.key === "concept")!,
		pref = concept.properties[0]!;
	const value = {
		kind: "literal" as const,
		value: "Concept",
		datatype: "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
		language: "en",
	};
	const record = {
		subject: { owner: "description", id: id("concept") },
		types: [concept.types[0]!.termId],
		statements: [{ id: id("label"), predicateId: pref.predicateId, value }],
	};
	expect(validateModelRecord(applicationModel, "concept", record).unmapped).toEqual([]);
	expect(() =>
		validateModelRecord(applicationModel, "concept", {
			...record,
			statements: [
				...record.statements,
				{ ...record.statements[0]!, id: id("other"), value: { ...value, language: "EN" } },
			],
		}),
	).toThrow(/unique per language/);
	const extra = {
		id: id("extra"),
		predicateId: id("unmapped"),
		value: { kind: "unknown" as const },
	};
	expect(() =>
		validateModelRecord(applicationModel, "concept", { ...record, statements: [extra] }),
	).toThrow(/write mapping/);
	expect(
		validateModelRecord(
			applicationModel,
			"concept",
			{ ...record, statements: [extra] },
			"description",
		).unmapped,
	).toEqual([extra.id]);
});
