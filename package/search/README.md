# Search Service

- [ ] 引入 meilisearch， meilibridge


cd /mnt/d/ICS/Library.Book/Library.Book/package/search/

bun run meilisearch:wsl

powershell -NoExit -Command {cd 'D:\ICS\Library.Book\Library.Book' pg_ctl start }

tabby --new-tab "cd D:\ICS\Library.Book\Library.Book; pg_ctl start" 
  --new-tab "cd D:\ICS\Library.Book\Library.Book\package\search; bun run meilisearch:wsl" `
  --new-tab "cd D:\ICS\Library.Book\Library.Book\package\app; bun dev"
