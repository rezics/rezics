const { spawn } = require("child_process");
const path = require("path");

// ✅ 当前目录 __dirname 已可用（CJS）
const TIMEOUT_MS = 3000;

function runDevCheck(name, dir, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`🔍 启动 ${name} 模块（${cmd.join(" ")})，监听错误输出...`);

        const fullPath = path.resolve(__dirname, "..", dir);
        const child = spawn(cmd[0], cmd.slice(1), {
            cwd: fullPath,
            shell: true,
        });

        let hasError = false;

        const timeout = setTimeout(() => {
            if (!hasError) {
                console.log(`⏰ ${name} 启动无报错，主动结束进程，认为通过。`);
                child.kill("SIGKILL");
                resolve();
            } else {
                reject(new Error(`❌ ${name} 启动失败（含错误输出）`));
            }
        }, TIMEOUT_MS);

        const onData = (data, stream) => {
            const text = data.toString();
            process[stream].write(text);
            if (text.includes("Error:")) {
                hasError = true;
                clearTimeout(timeout);
                child.kill("SIGKILL");
                reject(
                    new Error(
                        `❌ ${name} 启动输出中检测到错误：${text.trim()}`,
                    ),
                );
            }
        };

        child.stdout?.on("data", (data) => onData(data, "stdout"));
        child.stderr?.on("data", (data) => onData(data, "stderr"));

        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(new Error(`❌ ${name} 进程异常：${err.message}`));
        });

        child.on("exit", (code) => {
            if (!hasError && code === 0) {
                clearTimeout(timeout);
                resolve();
            }
        });
    });
}

// ✅ 启动流程
(async () => {
    console.log("Husky Check Begin");
    try {
        await runDevCheck("client", "package/client", ["pnpm", "dev"]);
        await runDevCheck("server", "package/server", ["pnpm", "start"]);
        console.log("✅ 所有模块检查通过，允许提交。");
        process.exit(0);
    } catch (e) {
        console.error(e.message || e);
        process.exit(1);
    }
})();
