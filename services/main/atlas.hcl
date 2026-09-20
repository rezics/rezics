data "external_schema" "drizzle" {
	program = [
		"yarn",
		"exec",
		"tsx",
		"scripts/export-database-schema.ts",
	]
}

env "main" {
	// Offline catalog normalization does not qualify parallel-query performance.
	dev = "postgres://postgres:postgres@localhost:5433/rezics_atlas_dev?search_path=public&sslmode=disable&options=-c%20max_parallel_workers_per_gather%3D0"

	schema {
		src = data.external_schema.drizzle.url
	}

	migration {
		dir              = "file://src/services/database/migrations"
		exec_order       = LINEAR
		revisions_schema = "public"

		// Atlas Community cannot inspect PostgreSQL functions or triggers. Their
		// canonical definitions live under schema/postgres and are verified against
		// migration replay separately; Atlas must not infer their removal.
		exclude = [
			"*[type=extension|function|trigger]",
			"unit_localization.unit_localization_pgroonga_*[type=index]",
		]
	}
}
