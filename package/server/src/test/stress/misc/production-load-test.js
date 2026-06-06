import { check, group, sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

export const loginDuration = new Trend("login_duration");
export const apiErrors = new Counter("api_errors");
export const successRate = new Rate("success_rate");

// 测试阈值 —— 若不满足则视为失败 (CI/CD Gate)
export const options = {
  stages: [
    { duration: "1m", target: 50 }, // ramp up to 50 users
    { duration: "3m", target: 200 }, // keep 200 VUs to load test
    { duration: "1m", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% 响应时间 < 500ms
    "checks{type:login}": ["rate>0.98"], // 登录成功率 > 98%
    success_rate: ["rate>0.97"], // API 成功率 > 97%
    api_errors: ["count<50"], // 错误数量少于 50
  },
};

const BASE_URL = "https://book.rezics.com";

function login() {
  const payload = JSON.stringify({
    email: "demo@example.com",
    password: "123456",
  });

  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  // 检查登录请求
  const ok = check(
    res,
    {
      "login: status 200": (r) => r.status === 200,
    },
    { type: "login" },
  );

  if (!ok) apiErrors.add(1);

  loginDuration.add(res.timings.duration);
  successRate.add(ok);

  return JSON.parse(res.body).token;
}

function getUserInfo(token) {
  const res = http.get(`${BASE_URL}/user/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const ok = check(res, {
    "user info: 200": (r) => r.status === 200,
  });

  if (!ok) apiErrors.add(1);
  successRate.add(ok);

  return res;
}

function postAction(token) {
  const payload = JSON.stringify({
    action: "do-something",
    value: Math.random(),
  });

  const res = http.post(`${BASE_URL}/action`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const ok = check(res, {
    "action: 200/201": (r) => r.status === 200 || r.status === 201,
  });

  if (!ok) apiErrors.add(1);
  successRate.add(ok);

  return res;
}

export default function () {
  group("user journey", () => {
    const token = login();
    getUserInfo(token);
    postAction(token);

    // 模拟真实思考时间
    sleep(Math.random() * 3 + 1);
  });
}
