import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  server: {
    /**
     * Selects the server runtime mode.
     * Use `production` for live traffic and delivery integrations.
     * 选择服务器运行时模式。
     * 在生产环境流量和交付集成中使用 `production`。
     */
    NODE_ENV: v.optional(
      v.union([
        v.literal("development"),
        v.literal("test"),
        v.literal("production"),
      ]),
    ),

    /**
     * PostgreSQL connection string used for the main server database.
     * This value is required at startup.
     * 主服务器数据库使用的 PostgreSQL 连接字符串。
     * 此值在启动时必须提供。
     */
    DATABASE_URL: v.string(),

    /**
     * Internal base URL used by main for service-to-service auth calls.
     * main 用于服务间认证调用的内部基础 URL。
     */
    AUTH_INTERNAL_BASE_URL: v.string(),

    /**
     * Browser-facing public auth boundary exposed by main.
     * main 暴露的面向浏览器的公开认证边界。
     */
    AUTH_PUBLIC_BASE_URL: v.string(),

    /**
     * Public issuer URL for auth/OIDC metadata.
     * auth/OIDC 元数据的公开签发者 URL。
     */
    AUTH_PUBLIC_ISSUER_URL: v.string(),

    /**
     * Shared secret for internal auth token endpoints when main must call them.
     * 当 main 必须调用内部认证令牌端点时使用的共享密钥。
     */
    AUTH_INTERNAL_TOKEN_GATEWAY_SECRET: v.string(),

    /**
     * Bootstrap-only audience for auth JWT validation metadata seeding.
     * Defaults to 'rezics'.
     * 仅用于引导阶段的受众，用于 auth JWT 验证元数据的初始化。
     * 默认为 'rezics'。
     */
    AUTH_JWT_AUDIENCE: v.optional(v.string()),

    /**
     * Allowed JWT clock skew in seconds, provided as a string.
     * Defaults to `5` when omitted.
     * 允许的 JWT 时钟偏差（秒），以字符串形式提供。
     * 省略时默认为 `5`。
     */
    AUTH_JWT_CLOCK_TOLERANCE_SECONDS: v.optional(v.string()),

    /**
     * Rezics session token lifetime in seconds. Defaults to 900 (15 minutes).
     * Rezics 会话令牌的生命周期（秒）。默认为 900（15 分钟）。
     */
    MAIN_SESSION_JWT_TTL_SECONDS: v.optional(v.string()),

    /**
     * JWKS signing key rotation interval in seconds. Defaults to 2592000 (30 days).
     * JWKS 签名密钥的轮换间隔（秒）。默认为 2592000（30 天）。
     */
    MAIN_SESSION_JWKS_ROTATION_SECONDS: v.optional(v.string()),

    /**
     * SMTP host used by main product email verification flows.
     * Main validates this value locally and passes it to `@rezics/email`.
     * main 产品邮件验证流程使用的 SMTP 主机。
     * main 在本地验证此值并将其传递给 `@rezics/email`。
     */
    SMTP_HOST: v.string(),

    /**
     * SMTP port used by main product email verification flows.
     * Defaults to `465`.
     * main 产品邮件验证流程使用的 SMTP 端口。
     * 默认为 `465`。
     */
    SMTP_PORT: v.fallback(v.string(), "465"),

    /**
     * Whether main SMTP delivery uses TLS from connection start.
     * Defaults to `true`; set to `false` for STARTTLS-style ports.
     * main 的 SMTP 投递是否从连接开始就使用 TLS。
     * 默认为 `true`；对于 STARTTLS 风格的端口设为 `false`。
     */
    SMTP_SECURE: v.fallback(v.string(), "true"),

    /**
     * SMTP username used by main product email verification flows.
     * Pair it with `SMTP_HOST` and `SMTP_PASSWORD` when configuring delivery.
     * main 产品邮件验证流程使用的 SMTP 用户名。
     * 配置投递时将其与 `SMTP_HOST` 和 `SMTP_PASSWORD` 搭配使用。
     */
    SMTP_USER: v.string(),

    /**
     * SMTP password used by main product email verification flows.
     * Pair it with `SMTP_HOST` and `SMTP_USER` when configuring an SMTP transport.
     * main 产品邮件验证流程使用的 SMTP 密码。
     * 配置 SMTP 传输时将其与 `SMTP_HOST` 和 `SMTP_USER` 搭配使用。
     */
    SMTP_PASSWORD: v.string(),

    /**
     * From email for main-owned product email verification messages.
     * main 拥有的产品邮件验证消息的发件人邮箱地址。
     */
    MAIN_EMAIL_FROM_EMAIL: v.fallback(v.string(), "noreply@rezics.com"),

    /**
     * From display name for main-owned product email verification messages.
     * main 拥有的产品邮件验证消息的发件人显示名称。
     */
    MAIN_EMAIL_FROM_NAME: v.optional(v.string()),

    /**
     * Sender display name for SMTP-backed mail features.
     * 基于 SMTP 的邮件功能的发件人显示名称。
     */
    SMTP_USER_NAME: v.optional(v.string()),

    /**
     * Cloudflare Turnstile secret used for server-side token verification.
     * 用于服务端令牌验证的 Cloudflare Turnstile 密钥。
     */
    TURNSTILE_SECRET: v.string(),

    /**
     * Meilisearch host URL.
     * Meilisearch 主机 URL。
     */
    MEILI_HOST: v.string(),

    /**
     * Meilisearch master/admin API key.
     * Meilisearch 主/管理 API 密钥。
     */
    MEILI_MASTER_KEY: v.string(),

    /**
     * Configures the server HTTP listen port as a string value.
     * Defaults to `3000` when omitted.
     * 以字符串值的形式配置服务器 HTTP 监听端口。
     * 省略时默认为 `3000`。
     */
    PORT: v.optional(v.string()),

    /**
     * Observability log output mode: local text or newline-delimited JSON.
     * 可观测性日志输出模式：本地文本或换行分隔的 JSON。
     */
    OBSERVABILITY_LOG_FORMAT: v.optional(
      v.union([v.literal("local"), v.literal("json")]),
    ),
    /**
     * Enables ANSI color for local observability output.
     * 为本地可观测性输出启用 ANSI 颜色。
     */
    OBSERVABILITY_COLOR: v.optional(v.string()),
    /**
     * Slow HTTP request threshold in milliseconds.
     * 慢速 HTTP 请求阈值（毫秒）。
     */
    OBSERVABILITY_SLOW_REQUEST_MS: v.optional(v.string()),
    /**
     * OpenTelemetry mode: auto, disabled, enabled, or required.
     * OpenTelemetry 模式：auto、disabled、enabled 或 required。
     */
    OBSERVABILITY_TELEMETRY: v.optional(
      v.union([
        v.literal("auto"),
        v.literal("disabled"),
        v.literal("enabled"),
        v.literal("required"),
      ]),
    ),
    /**
     * OTLP HTTP traces endpoint. When omitted, telemetry export is disabled.
     * OTLP HTTP 追踪端点。省略时禁用遥测导出。
     */
    OTEL_EXPORTER_OTLP_ENDPOINT: v.optional(v.string()),

    /**
     * S3-compatible API endpoint URL.
     * S3 兼容的 API 端点 URL。
     */
    S3_ENDPOINT: v.optional(v.string()),
    /**
     * S3 access key ID.
     * S3 访问密钥 ID。
     */
    S3_ACCESS_KEY_ID: v.optional(v.string()),
    /**
     * S3 secret access key.
     * S3 私有访问密钥。
     */
    S3_SECRET_ACCESS_KEY: v.optional(v.string()),
    /**
     * S3 bucket name.
     * S3 存储桶名称。
     */
    S3_BUCKET: v.optional(v.string()),
    /**
     * S3 region. Defaults to "auto" for Cloudflare R2.
     * S3 区域。Cloudflare R2 默认为 "auto"。
     */
    S3_REGION: v.optional(v.string()),
    /**
     * Public base URL for serving uploaded media.
     * 上传媒体文件的公开基础 URL。
     */
    MEDIA_PUBLIC_BASE_URL: v.optional(v.string()),
    /**
     * Max upload size in bytes. Defaults to 10 MB.
     * 最大上传字节数。默认 10 MB。
     */
    MEDIA_MAX_UPLOAD_SIZE: v.optional(v.pipe(v.string(), v.transform(Number))),
    /**
     * Presigned URL expiry in seconds. Defaults to 600.
     * 预签名 URL 过期秒数。默认 600。
     */
    MEDIA_PRESIGN_EXPIRY: v.optional(v.pipe(v.string(), v.transform(Number))),

    /**
     * Base URL of the Notify service for internal calls.
     * Notify 服务用于内部调用的基础 URL。
     */
    NOTIFY_BASE_URL: v.string(),

    /**
     * Shared secret for authenticating internal calls to the Notify service.
     * 用于对 Notify 服务的内部调用进行认证的共享密钥。
     */
    NOTIFY_INTERNAL_SECRET: v.string(),

    /**
     * Base URL of the Reaction service for internal calls.
     * Reaction 服务用于内部调用的基础 URL。
     */
    REACTION_BASE_URL: v.string(),

    /**
     * Shared secret for authenticating internal calls to the Reaction service.
     * 用于对 Reaction 服务的内部调用进行认证的共享密钥。
     */
    REACTION_INTERNAL_SECRET: v.string(),

    /**
     * Base URL of the History service for app-facing read proxy requests.
     * When omitted, history proxy endpoints return a clear service-unavailable
     * response instead of bypassing Unit visibility checks.
     * History 服务用于面向应用的读取代理请求的基础 URL。
     * 省略时，history 代理端点返回明确的服务不可用响应，
     * 而不会绕过 Unit 可见性检查。
     */
    HISTORY_BASE_URL: v.optional(v.string()),

    /**
     * Base URL of the dispatch hub for audit notifications.
     * 用于审计通知的 dispatch hub 基础 URL。
     */
    DISPATCH_HUB_URL: v.optional(v.string()),

    /**
     * HMAC shared secret for signing dispatch audit notifications.
     * 用于签名 dispatch 审计通知的 HMAC 共享密钥。
     */
    DISPATCH_RECEIPT_SECRET: v.optional(v.string()),

    /**
     * Project identifier for dispatch integration.
     * 用于 dispatch 集成的项目标识符。
     */
    DISPATCH_PROJECT_ID: v.optional(v.string()),

    /**
     * Internal base URL for durable job-runner enqueue requests.
     * 用于持久化 job-runner 入队请求的内部基础 URL。
     */
    JOB_RUNNER_BASE_URL: v.optional(v.string()),

    /**
     * Shared secret for authenticating internal job-runner enqueue requests.
     * 用于对内部 job-runner 入队请求进行认证的共享密钥。
     */
    JOB_RUNNER_INTERNAL_SECRET: v.optional(v.string()),

    /**
     * Browser-facing application URL shown on the internal status page.
     * 在内部状态页面上显示的面向浏览器的应用 URL。
     */
    STATUS_APP_URL: v.optional(v.string()),

    /**
     * Browser/operator-facing main server URL shown on the status page.
     * 在状态页面上显示的面向浏览器/运维人员的 main 服务器 URL。
     */
    STATUS_SERVER_URL: v.optional(v.string()),

    /**
     * Auth service health URL used by the internal status aggregator.
     * 内部状态聚合器使用的 auth 服务健康检查 URL。
     */
    STATUS_AUTH_HEALTH_URL: v.optional(v.string()),

    /**
     * Job-runner health/admin base URL used by the internal status aggregator.
     * 内部状态聚合器使用的 job-runner 健康检查/管理基础 URL。
     */
    STATUS_JOB_RUNNER_URL: v.optional(v.string()),

    /**
     * Meilisearch operator URL shown on the internal status page.
     * 在内部状态页面上显示的 Meilisearch 运维 URL。
     */
    STATUS_MEILI_URL: v.optional(v.string()),

    /**
     * Sequin UI URL shown on the internal status page.
     * 在内部状态页面上显示的 Sequin UI URL。
     */
    STATUS_SEQUIN_UI_URL: v.optional(v.string()),

    /**
     * Sequin health endpoint checked by the internal status aggregator.
     * 内部状态聚合器检查的 Sequin 健康检查端点。
     */
    STATUS_SEQUIN_HEALTH_URL: v.optional(v.string()),

    /**
     * Safe display name for the Sequin sink/webhook target.
     * Sequin sink/webhook 目标的安全显示名称。
     */
    STATUS_SEQUIN_WEBHOOK_TARGET_NAME: v.optional(v.string()),

    /**
     * Source database publication expected by Sequin CDC.
     * Sequin CDC 所期望的源数据库 publication。
     */
    STATUS_CDC_PUBLICATION_NAME: v.optional(v.string()),

    /**
     * Source database replication slot expected by Sequin CDC.
     * Sequin CDC 所期望的源数据库 replication slot。
     */
    STATUS_CDC_REPLICATION_SLOT_NAME: v.optional(v.string()),

    /**
     * Byte threshold where replication slot lag degrades CDC status.
     * replication slot 滞后导致 CDC 状态降级的字节阈值。
     */
    STATUS_CDC_LAG_WARNING_BYTES: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
