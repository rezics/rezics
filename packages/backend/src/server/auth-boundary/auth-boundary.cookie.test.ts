import { describe, expect, test } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_INTERNAL_BASE_URL ??= "http://auth.internal";
process.env.AUTH_PUBLIC_BASE_URL ??= "http://main.test/auth";
process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://main.test";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "internal-test-secret";
process.env.SMTP_HOST ??= "localhost";
process.env.SMTP_USER ??= "smtp";
process.env.SMTP_PASSWORD ??= "smtp";
process.env.TURNSTILE_SECRET ??= "turnstile";
process.env.MEILI_HOST ??= "http://localhost:7700";
process.env.MEILI_MASTER_KEY ??= "masterKey";
process.env.NOTIFY_BASE_URL ??= "http://localhost:3010";
process.env.NOTIFY_INTERNAL_SECRET ??= "notify";
process.env.REACTION_BASE_URL ??= "http://localhost:3011";
process.env.REACTION_INTERNAL_SECRET ??= "reaction";

const { buildCookieAttributes } = await import("./auth-boundary.service");

const SESSION = "rezics-session-token";

describe("buildCookieAttributes (subdomain-trust-boundary)", () => {
  test("production session cookie carries Domain=.rezics.com and Secure", () => {
    const header = buildCookieAttributes({
      name: SESSION,
      token: "signed-jwt",
      maxAgeSeconds: 900,
      isProduction: true,
      issuerUrl: "https://book.rezics.com",
    });

    expect(header).toContain(`${SESSION}=signed-jwt`);
    expect(header).toContain("Domain=.rezics.com");
    expect(header).toContain("Path=/");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=900");
    expect(header).toContain("Secure");
  });

  test("development cookie omits Domain and Secure on localhost issuer", () => {
    const header = buildCookieAttributes({
      name: SESSION,
      token: "signed-jwt",
      maxAgeSeconds: 900,
      isProduction: false,
      issuerUrl: "http://localhost:35001",
    });

    expect(header).toContain(`${SESSION}=signed-jwt`);
    expect(header).not.toContain("Domain=");
    expect(header).not.toContain("Secure");
    expect(header).toContain("Path=/");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=900");
  });

  test("production logout clear cookie keeps Domain attribute and Max-Age=0 (logout symmetry)", () => {
    const header = buildCookieAttributes({
      name: SESSION,
      token: null,
      maxAgeSeconds: 900,
      isProduction: true,
      issuerUrl: "https://book.rezics.com",
    });

    expect(header).toContain(`${SESSION}=`);
    expect(header).toContain("Domain=.rezics.com");
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");
  });

  test("development logout clear cookie omits Domain and uses Max-Age=0", () => {
    const header = buildCookieAttributes({
      name: SESSION,
      token: null,
      maxAgeSeconds: 900,
      isProduction: false,
      issuerUrl: "http://localhost:35001",
    });

    expect(header).toContain(`${SESSION}=`);
    expect(header).not.toContain("Domain=");
    expect(header).not.toContain("Secure");
    expect(header).toContain("Max-Age=0");
  });

  test("logout Domain attribute matches creation Domain attribute (symmetric clear)", () => {
    const createHeader = buildCookieAttributes({
      name: SESSION,
      token: "signed",
      maxAgeSeconds: 900,
      isProduction: true,
      issuerUrl: "https://book.rezics.com",
    });
    const clearHeader = buildCookieAttributes({
      name: SESSION,
      token: null,
      maxAgeSeconds: 900,
      isProduction: true,
      issuerUrl: "https://book.rezics.com",
    });

    const createDomain = createHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("Domain="));
    const clearDomain = clearHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("Domain="));

    expect(createDomain).toBe("Domain=.rezics.com");
    expect(clearDomain).toBe(createDomain);
    expect(clearHeader).toContain("Max-Age=0");
  });

  test("non-production with https issuer (staging) still applies Secure but omits Domain", () => {
    const header = buildCookieAttributes({
      name: SESSION,
      token: "signed",
      maxAgeSeconds: 900,
      isProduction: false,
      issuerUrl: "https://staging.rezics.com",
    });

    expect(header).toContain("Secure");
    expect(header).not.toContain("Domain=");
  });
});
