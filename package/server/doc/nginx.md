## CORS 配置

> CORS 策略以 Elysia 应用内配置为准，Nginx 不应再维护一套独立的 Allow-Origin 逻辑。

当前约定：

- `/api/session/jwks` 是公开 JWKS 路由，使用非凭证 CORS
- `/api/session/token` 和其他会话路由保持凭证型 CORS
- Nginx 只负责把 `OPTIONS`、`Origin` 和常规代理头转发给应用

推荐保留一个最小代理配置，不在 Nginx 层追加 `Access-Control-*` 响应头：

```
location ^~ / {
  proxy_pass_request_headers on;
  proxy_pass_request_body on;

  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $http_host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Real-Port $remote_port;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
  proxy_set_header X-Forwarded-Port $server_port;
  proxy_set_header REMOTE-HOST $remote_addr;

  proxy_connect_timeout 60s;
  proxy_send_timeout 600s;
  proxy_read_timeout 600s;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
}
```
