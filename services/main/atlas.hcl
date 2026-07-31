data "external_schema" "drizzle" {
	program = [
		"yarn",
		"exec",
		"tsx",
		"scripts/export-database-schema.ts",
	]
}

env "main" {
	dev = "postgres://postgres:postgres@localhost:5433/rezics_atlas_dev?search_path=public&sslmode=disable"

	schema {
		src = data.external_schema.drizzle.url
	}

	migration {
		dir              = "file://src/services/database/migrations"
		exec_order       = LINEAR
		revisions_schema = "public"

		// Drizzle does not export these durable objects, so explicit SQL
		// migrations own them and Atlas must not infer their removal.
		exclude = ["*[type=extension|function|trigger]"]
	}
}
