data "external_schema" "drizzle" {
	program = [
		"yarn",
		"exec",
		"tsx",
		"scripts/export-database-schema.ts",
	]
}

env "main" {
	dev = "postgres://postgres:postgres@localhost:5433/rezics_atlas?search_path=public&sslmode=disable"

	schema {
		src = data.external_schema.drizzle.url
	}

	migration {
		dir              = "file://src/services/database/migrations"
		exec_order       = LINEAR
		revisions_schema = "public"

		// These objects remain owned by explicit SQL migrations rather than
		// Drizzle's schema export. The legacy ledger is ignored during cutover.
		exclude = [
			"__drizzle_migrations",
			"*[type=extension|function|trigger]",
		]
	}
}
