import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function requireRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
	const value = record[key];
	if (!isRecord(value)) throw new Error(`aspire.config.json field ${key} must be an object`);
	return value;
}

function requireString(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	if (typeof value !== "string")
		throw new Error(`aspire.config.json field ${key} must be a string`);
	return value;
}

describe("Aspire OpenTelemetry integration", () => {
	it("uses Aspire HTTP exporters without fixing dashboard ports in the launch profile", async () => {
		const [configurationSource, appHostSource] = await Promise.all([
			readFile(new URL("../../../aspire.config.json", import.meta.url), "utf8"),
			readFile(new URL("../../../aspire-apphost/apphost.mts", import.meta.url), "utf8"),
		]);
		const parsed: unknown = JSON.parse(configurationSource);
		if (!isRecord(parsed)) throw new Error("aspire.config.json must contain an object");
		const profiles = requireRecord(parsed, "profiles");
		const httpsProfile = requireRecord(profiles, "https");
		const environmentVariables = requireRecord(httpsProfile, "environmentVariables");

		expect(httpsProfile).not.toHaveProperty("applicationUrl");
		expect(environmentVariables).not.toHaveProperty("ASPIRE_DASHBOARD_OTLP_HTTP_ENDPOINT_URL");
		expect(environmentVariables).not.toHaveProperty("ASPIRE_RESOURCE_SERVICE_ENDPOINT_URL");
		expect(requireString(environmentVariables, "ASPIRE_ALLOW_UNSECURED_TRANSPORT")).toBe("true");
		expect(environmentVariables).not.toHaveProperty("ASPIRE_DASHBOARD_OTLP_ENDPOINT_URL");
		expect(appHostSource).not.toContain('.withEnvironment("OTEL_EXPORTER_OTLP_PROTOCOL"');
		expect(
			appHostSource.match(/\.withOtlpExporter\(\{ protocol: OtlpProtocol.HttpProtobuf \}\)/g),
		).toHaveLength(2);
	});
});
