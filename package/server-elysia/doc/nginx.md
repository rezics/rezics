    
if ($request_method = OPTIONS)  添加 allow-Origin，可以让请求传给 elysia


推荐放在：root /www/wwwroot/book-server.rezics.com; 后面？

```
set $cors_origin "";

# 匹配以下两种情况：
# 1. https://rezics.com（裸域）
# 2. https://任意子域名.rezics.com
if ($http_origin ~* "^https?://([a-z0-9-]+\.)*rezics\.com(:[0-9]+)?$") {
    set $cors_origin $http_origin;
}
```


```    
location ^~ / {
  if ($request_method = OPTIONS) {
  add_header Access-Control-Allow-Origin $cors_origin;
  add_header Access-Control-Allow-Credentials "true";
  add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
  add_header Access-Control-Allow-Headers "*";
  add_header Access-Control-Max-Age 86400;
  return 204;
  }

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
