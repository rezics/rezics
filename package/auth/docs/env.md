# Environment Variables

Auth Server 依赖若干关键环境变量用于安全通信、JWT 签名以及内部服务鉴权。如果这些变量未配置，启动时会触发 schema validation error，例如：

```
Invalid type: Expected string but received undefined
path: BETTER_AUTH_URL
```

因此在部署或本地运行前必须正确配置 `.env`。

## DATABASE_URL

example:

```
DATABASE_URL="postgresql://postgres@localhost:5432/rezics_auth?schema=public"
```

## BETTER_AUTH_URL

**类型**

```
string
```

**用途**

Auth Server 的 **公开访问地址（Issuer URL）**。

该地址用于：

* OAuth / OIDC issuer
* JWT `iss` claim
* OAuth 回调 URL
* 生成 OAuth metadata

客户端与服务端都会使用该地址发现授权服务器。

**示例**

```
BETTER_AUTH_URL=https://auth.rezics.com
```

本地开发环境：

```
BETTER_AUTH_URL=http://localhost:3002
```

**注意**

* 必须与 OAuth issuer 完全一致
* 必须使用 HTTPS（生产环境）
* 所有 OAuth metadata 端点会基于此 URL 生成

---

## BETTER_AUTH_SECRET

**类型**

```
string (high-entropy secret)
```

**用途**

Better Auth 内部使用的 **主加密密钥**，用于：

* session token 加密
* CSRF token
* OAuth state
* cookie signing
* internal crypto

该 secret **不会用于 JWT ES256 签名**。

JWT 签名将使用独立的 **ES256 private key**。

**安全要求**

* 必须是高熵随机字符串
* 长度建议 ≥ 32 bytes
* 不可提交到 git
* 不可在多个环境共享

**生成方法**

推荐使用 `openssl`：

```
openssl rand -base64 32
```

示例输出：

```
BETTER_AUTH_SECRET=1W2L6q9yq4cCqf7S8G1oJ7cT1c6LQkP0Yc4m0cXzFj8=
```

或使用 Node.js：

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## AUTH_INTERNAL_TOKEN_GATEWAY_SECRET

**类型**

```
string
```

**用途**

用于 **内部服务之间的 token gateway 验证**。

在 Rezics 架构中：

```
client
   │
   ▼
auth server
   │
   ▼
internal services (server / search / admin)
```

部分内部 API 需要通过 **Gateway Token** 调用 Auth Server。

此 secret 用于：

* 保护内部 token exchange endpoint
* 防止外部客户端伪造服务调用
* 服务到服务认证

例如：

```
Authorization: Bearer INTERNAL_TOKEN
```

Auth Server 将使用该 secret 验证 token。

**示例**

```
AUTH_INTERNAL_TOKEN_GATEWAY_SECRET=rezics_internal_gateway_secret
```

**生成方法**

推荐同样使用随机生成：

```
openssl rand -base64 32
```

---

# Example `.env`

```
# Auth server base url
BETTER_AUTH_URL=http://localhost:3001

# Better Auth internal secret
BETTER_AUTH_SECRET=replace-with-random-secret

# Internal service gateway secret
AUTH_INTERNAL_TOKEN_GATEWAY_SECRET=replace-with-random-secret

# SMTP mail delivery
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mailer@example.com
SMTP_PASSWORD=replace-with-mail-password
SMTP_USER_NAME=Rezics Auth

# Sender addresses
AUTH_INVITATION_FROM_EMAIL=invite@example.com
AUTH_PASSWORD_RESET_FROM_EMAIL=reset@example.com
AUTH_VERIFICATION_FROM_EMAIL=verify@example.com
```

---

# Production Recommendations

| 项目                               | 建议                         |
| ---------------------------------- | ---------------------------- |
| BETTER_AUTH_SECRET                 | 使用 32–64 byte 随机字符串   |
| AUTH_INTERNAL_TOKEN_GATEWAY_SECRET | 与 BETTER_AUTH_SECRET 不同   |
| Secret Rotation                    | 每 6–12 个月轮换             |
| Secret Storage                     | 使用 Secret Manager / Vault  |
| Git                                | `.env` 必须加入 `.gitignore` |

---

## SMTP / Nodemailer Delivery

`package/auth` 使用 SMTP + `nodemailer` 发送身份相关通知邮件，不使用 `resend`。

必需 SMTP 配置：

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`

可选 SMTP 配置：

- `SMTP_PORT`，默认 `465`
- `SMTP_SECURE`，默认 `true`
- `SMTP_USER_NAME`，用于构造 `Name <email>` 形式的发件人

发件人优先级：

- 邀请邮件：`AUTH_INVITATION_FROM_EMAIL`
- 密码重置：`AUTH_PASSWORD_RESET_FROM_EMAIL ?? AUTH_INVITATION_FROM_EMAIL`
- 验证/改邮箱：`AUTH_VERIFICATION_FROM_EMAIL ?? AUTH_INVITATION_FROM_EMAIL`

在 `development` / `test` 环境中，通知服务默认只记录日志，不发送真实邮件。

该通知层为后续 Telegram 通知扩展预留了结构，但当前版本仅实现邮件通道。
