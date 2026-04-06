import "dotenv/config";

export function getProdState() {
  // Bun 有两个 env：
  // 1. Bun.env   → 在 --compile 下是 *真正* 的 runtime 环境变量
  // 2. process.env → 在 --compile 下的 NODE_ENV 会固定为 "development"（Bun 的已知 bug）

  const bunEnv = Bun?.env?.NODE_ENV;
  const nodeEnv = process?.env?.NODE_ENV;

  // 统一获取环境变量（避免 bundler 静态折叠）
  const env = bunEnv ?? nodeEnv ?? "development";

  // 返回布尔值和实际字符串
  return {
    NODE_ENV: env,
    isProd: env === "production",
    isDev: env === "development",
    isTest: env === "test",
  };
}
