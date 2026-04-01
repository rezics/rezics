#!/usr/bin/env pwsh

$SESSION = "library-book"

$ROOT_DIR = Resolve-Path (Join-Path $PSScriptRoot "../../..")

$PACKAGES = @(
    "auth"
    "server"
    "app"
    "admin"
)

tmux kill-session -t $SESSION 2>$null

tmux new-session -d -s $SESSION -c $ROOT_DIR

for ($i = 0; $i -lt $PACKAGES.Length; $i++) {

    $pkg = $PACKAGES[$i]
    $pkgDir = Join-Path $ROOT_DIR "package/$pkg"

    if ($i -eq 0) {

        tmux rename-window -t "${SESSION}:0" $pkg
        tmux send-keys -t "${SESSION}:$pkg" "cd $pkgDir; bun dev" C-m

    } else {

        tmux new-window -t $SESSION -n $pkg -c $ROOT_DIR
        tmux send-keys -t "${SESSION}:$pkg" "cd $pkgDir; bun dev" C-m

    }
}

tmux select-window -t "${SESSION}:${PACKAGES[0]}"

tmux attach-session -t $SESSION
