# Development Notes

## Running Meilisearch

```bash
# Linux / macOS
cd package/search
task meilisearch

# WSL
task meilisearch:wsl
```

## Windows (PowerShell) Multi-Service Startup

```powershell
tabby --new-tab "cd D:\path\to\project; pg_ctl start" `
      --new-tab "cd D:\path\to\project\package\search; task meilisearch:wsl" `
      --new-tab "cd D:\path\to\project\package\app; task dev"
```
