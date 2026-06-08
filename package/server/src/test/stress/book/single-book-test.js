import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { check, sleep } from "k6";
import http from "k6/http";

// Load strategy — use on a single node alongside CPU/memory monitoring.
// 压力策略 — 单节点配合 CPU/内存监控使用。
export const options = {
  vus: 300, // Initial virtual user count — 初始虚拟用户数量
  duration: "30s", // Load test duration — 压测时长
  thresholds: {
    http_req_duration: ["p(95)<300"], // 95% of requests < 300ms — 95% 请求 < 300ms
    http_req_failed: ["rate<0.02"], // Failure rate < 2% — 失败率 < 2%
  },
};

// const BASE_URL =
//   __ENV.BASE_URL ||
//   'http://localhost:3000/readlists/019ad6a0-e63a-7bf4-8b84-49084cc11519';

const BASE_URL =
  "https://book-server.rezics.com/readlists/019ae47b-09ca-7f65-989e-453f3b46249f";

export default function () {
  const res = http.get(BASE_URL);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
  });

  if (!ok) console.error("Response Error:", res.status);

  sleep(0.1);
}

// Automatically generate an HTML report after the test finishes.
// 测试结束后自动生成 HTML 报告。
export function handleSummary(data) {
  return {
    "load-test-report.html": htmlReport(data),
    stdout: JSON.stringify(data), // Optional: keep JSON output — 可选：保留 JSON 输出
  };
}
