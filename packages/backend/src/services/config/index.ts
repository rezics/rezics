import { Config as C, Context, Layer, Redacted } from "effect";

export class Config extends Context.Service<Config>()("@rezics/backend/Config", {
  make: C.all({
    server: C.all({
      port: C.port("PORT").pipe(C.withDefault(30000)),
      host: C.string("HOST").pipe(C.withDefault("0.0.0.0")),
      baseURL: C.string("BETTER_AUTH_URL").pipe(C.withDefault("http://localhost:30000")),
      corsOrigins: C.string("CORS_ORIGINS").pipe(
        C.withDefault("http://localhost:3000"),
        C.map((origins) => origins.split(",")),
      ),
    }),
    database: C.all({
      url: C.url("DATABASE_URL").pipe(C.map((u) => Redacted.make(u.toString()))),
    }),
    s3: C.option(
      C.all({
        endpoint: C.string("S3_ENDPOINT"),
        accessKeyId: C.redacted("S3_ACCESS_KEY_ID"),
        secretAccessKey: C.redacted("S3_SECRET_ACCESS_KEY"),
        bucket: C.string("S3_BUCKET").pipe(C.withDefault("rezics")),
        region: C.string("S3_REGION").pipe(C.withDefault("auto")),
      }),
    ),
    media: C.all({
      publicBaseUrl: C.string("MEDIA_PUBLIC_BASE_URL").pipe(C.withDefault("http://localhost:9000/rezics")),
      maxUploadSize: C.number("MEDIA_MAX_UPLOAD_SIZE").pipe(C.withDefault(10_485_760)),
      presignExpiry: C.number("MEDIA_PRESIGN_EXPIRY").pipe(C.withDefault(600)),
    }),
    search: C.all({
      host: C.string("MEILISEARCH_HOST").pipe(C.withDefault("http://localhost:7700")),
      apiKey: C.redacted("MEILISEARCH_API_KEY").pipe(C.option),
    }),
    pagination: C.all({
      defaultLimit: C.number("PAGINATION_DEFAULT_LIMIT").pipe(C.withDefault(25)),
      maxLimit: C.number("PAGINATION_MAX_LIMIT").pipe(C.withDefault(100)),
    }),
  }),
}) {}

export namespace Config {
  export const layer = Layer.effect(Config, Config.make);
}
