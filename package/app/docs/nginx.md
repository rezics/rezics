为SPA 项目自动路由支持

```
location / {
  try_files $uri $uri/ /index.html;
}
```

```
# === 反向代理 API ===
location /api/ {
    # 移除 "/api" 前缀再转发
    rewrite ^/api/(.*)$ /$1 break;

    proxy_pass https://book-server.rezics.com;

    # 代理头部
    proxy_set_header Host book-server.rezics.com;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;

    # 避免 Cloudflare/浏览器缓存 API
    proxy_buffering off;

    # 避免 WebSocket / streaming 问题
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}

```
