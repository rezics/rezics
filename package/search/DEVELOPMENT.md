# Development Notes

## Running Meilisearch

```bash
# Linux / macOS
cd package/search
bun run meilisearch

# WSL
bun run meilisearch:wsl
```

## Windows (PowerShell) Multi-Service Startup

```powershell
tabby --new-tab "cd D:\path\to\project; pg_ctl start" `
      --new-tab "cd D:\path\to\project\package\search; bun run meilisearch:wsl" `
      --new-tab "cd D:\path\to\project\package\app; bun dev"
```
