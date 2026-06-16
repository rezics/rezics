# Git 工作流程

Rezics 保持精簡的 `main` history，並把 task-branch development history 保留在
`archive/*` 下。

## Mainline

`main` 是目前工作的唯一 integration baseline。Feature、fix、refactor branches
都從 `main` 開始；完成的工作會以一個 coherent commit 進入 `main`，除非
maintainer 明確選擇不同的 merge strategy。

`main` 保存 product-level history：每個 commit 對應一個完成的 feature、fix、
refactor 或 maintenance change。`archive/*` 保存 development-level history：
產出該結果的較小 commits、iterations 與 review fixes。

## Branch Roles

- `main` - 目前 integration branch 與 source of truth。
- `release/*` - release freeze、release candidates 與 patch lines。
- `stable/*` - 只用於舊版本的 long-lived maintenance lines。
- `<owner>/<topic>` - 個人或 agent-owned work lines。owner 必須清楚，例如
  `edge/crawler-preview-routing` 或 `codex/share-reference-counts`。
- `feat/<topic>` / `fix/<topic>` / `refactor/<topic>` - 預期 merge 到 `main`
  的 shared task branches。保持數量少且狀態清楚。
- `spike/<topic>` - exploration 或 experiments，不承諾 integration。
- `archive/<date>-<type>-<topic>` - 不再用於日常開發的 historical snapshots。
  使用 `YYMMDD-type-topic`，例如
  `archive/260606-feat-crawler-preview-routing`。
- `backup/*` - 只作 emergency insurance，不是一般 workflow。

## Feature Lifecycle

從目前 mainline 建立 task branches：

```bash
git switch main
git pull --ff-only
git switch -c feat/<topic>
```

開發時把 feature history 保持在 task branch 本地。Integration 前，除非
maintainer 要求 merge-based update，否則 rebase 到目前 mainline：

```bash
git fetch origin
git rebase origin/main
```

Feature 完成時：

1. 記錄 feature base SHA 和最終 feature tip SHA。
2. 在 feature tip 建立 archive branch 並 push。
3. 將 feature squash 成 `main` 上的一個 commit。
4. 在 squash commit trailers 中包含 archive metadata。
5. 遠端 archive branch 存在後，刪除 active `feat/*`、`fix/*` 或
   `refactor/*` branch。

Archive ref 可以透過重新命名 local branch 建立，也可以把相同 tip push 到新的
remote ref。Remote Git 只需要最終 archive ref 指向被保留的 history；它不會保留
portable branch-rename event。

## Squash Commit Messages

產生 mainline squash message 時，使用 `.agents/skills/git-mainline-squash`。訊息
包含三個部分：

```text
<type>(<optional scope>): <subject>

<body>

Archive-ref: archive/YYMMDD-type-topic
Archive-tip: <feature-tip-sha>
Feature-base: <feature-base-sha>
Original-branch: <original-branch>
Pull-request: #123
```

Subject 是 Conventional Commit first line。Body 是 GitHub squash UI 的 commit
description：一段精簡 integration summary，並可選擇用 bullets 標出主要 surfaces，
例如 contract、server、app、migrations、tests 或 tooling。不要把 routine process
work 放進 body。

Archive trailers 是 custom Git trailers。最終 metadata 可用時使用 full SHAs。
只有沒有 PR 時才省略 `Pull-request`。

範例：

```text
feat(crawler): add preview routing

Route crawler preview units through the shared app and server surfaces so
catalog preview flows resolve consistently.

- Adds preview route contract and server handling
- Wires frontend access through the shared API layer
- Covers routing behavior with focused tests

Archive-ref: archive/260606-feat-crawler-preview-routing
Archive-tip: <feature-tip-sha>
Feature-base: <feature-base-sha>
Original-branch: feat/crawler-preview-routing
Pull-request: #123
```

## Mainline Cutovers

Repository baseline cutovers 使用 `archive/<date>-mainline-<topic>` 和
mainline-reset trailers，而不是 feature trailers。2026-06-06 的 `dev` 到 `main`
cutover archive 是：

```text
archive/260606-mainline-dev-before-main
```

Main snapshot commit 應使用：

```text
chore: establish mainline snapshot

Create the new main integration baseline from the current repository state.

Archive-ref: archive/260606-mainline-dev-before-main
Archive-tip: <archived-dev-tip-sha>
Original-branch: dev
Mainline-reset: 2026-06-06
```

## 透過 Archives 追蹤 Blame

一般對 `main` 做 blame，可以回答是哪個 integrated change 引入某行：

```bash
git blame -- path/to/file
```

如果被 blame 到的 commit 是 squash commit，檢查它的 archive trailers：

```bash
git show <squash-sha>
```

然後使用 archived branch 檢查 feature-level history：

```bash
git blame archive/260606-feat-crawler-preview-routing -- path/to/file
git log --oneline <feature-base-sha>..<feature-tip-sha>
```

這個 workflow 刻意分開兩個問題：`main` blame 回答是哪個完成的 feature、fix 或
refactor 引入某行；`archive/*` blame 回答是哪個內部 feature commit 引入它。
