import type { StaticDecode } from "typebox";
import Elysia, { t } from "elysia";

const AgentGuideResponse = t.Object(
	{
		version: t.Literal("1"),
		contribution: t.Object(
			{
				requestField: t.Literal("revisionContext.contribution"),
				primaryValues: t.Array(
					t.Union([t.Literal("human"), t.Literal("ai"), t.Literal("unattributed")]),
				),
				aiRequirements: t.Array(t.String()),
				assurance: t.Literal("server_derived"),
			},
			{ additionalProperties: false },
		),
		workflow: t.Object(
			{
				readBeforeWrite: t.Literal(true),
				entitySearchPath: t.Literal("/api/v1/entities"),
				entitySearchKind: t.Literal("software_agent"),
				noModelVersionField: t.Literal(true),
				mixedResult: t.Literal("unattributed"),
				unresolvedEntity: t.Literal("unattributed_or_stop"),
				noOpCreatesRevision: t.Literal(false),
				staleWrite: t.Literal("reload_and_retry_with_latest_revision"),
			},
			{ additionalProperties: false },
		),
		boundaries: t.Array(t.String()),
	},
	{ additionalProperties: false },
);

const agentGuide: StaticDecode<typeof AgentGuideResponse> = {
	version: "1",
	contribution: {
		requestField: "revisionContext.contribution",
		primaryValues: ["human", "ai", "unattributed"],
		aiRequirements: [
			"Search the exact AI model or named agent as a software_agent Entity before writing.",
			"Use the stable creditedEntityId returned by Entity search.",
			"Distinct public model versions are distinct Entities; do not send a model-version field.",
		],
		assurance: "server_derived",
	},
	workflow: {
		readBeforeWrite: true,
		entitySearchPath: "/api/v1/entities",
		entitySearchKind: "software_agent",
		noModelVersionField: true,
		mixedResult: "unattributed",
		unresolvedEntity: "unattributed_or_stop",
		noOpCreatesRevision: false,
		staleWrite: "reload_and_retry_with_latest_revision",
	},
	boundaries: [
		"AI credit identifies primary revision contribution, not account responsibility or authorization.",
		"Whole-Unit creditAttribution and Unit aiDisclosure are separate contracts.",
		"Do not claim credential_bound or server_observed assurance from a client request.",
		"Do not export hidden, suppressed, private, unlicensed, or non-consented history as correction data.",
	],
};

export default new Elysia().get(
	"/.well-known/rezics-agent.json",
	{
		response: { 200: AgentGuideResponse },
		detail: {
			operationId: "getRezicsAgentGuide",
			summary: "Get the versioned REZICS contribution guide for agents",
			tags: ["Agents"],
		},
	},
	({ set }) => {
		set.headers["Cache-Control"] = "public, max-age=300";
		return agentGuide;
	},
);
