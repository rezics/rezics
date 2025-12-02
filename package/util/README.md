
```sh
cd /www/wwwroot/Library.Book/Library.Book/package/util/
bun run deploy
```

```
systemctl restart rezbooklib.service
journalctl -u rezbooklib.service -n 100
journalctl -u rezbooklib.service -f
```
