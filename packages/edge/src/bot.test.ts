import { describe, expect, test } from "bun:test";
import { isVerifiedBotRequest } from "./bot";

describe("edge bot detection", () => {
  test("uses Cloudflare verified bot signal first", () => {
    const request = new Request("https://rezics.com/book/1") as Request & {
      cf?: { botManagement?: { verifiedBot?: boolean } };
    };
    request.cf = { botManagement: { verifiedBot: true } };

    expect(isVerifiedBotRequest(request)).toBe(true);
  });

  test("recognizes constrained social unfurler user agents", () => {
    const request = new Request("https://rezics.com/book/1", {
      headers: { "user-agent": "Slackbot-LinkExpanding 1.0" },
    });

    expect(isVerifiedBotRequest(request)).toBe(true);
  });

  test("does not classify ordinary browsers as bots", () => {
    const request = new Request("https://rezics.com/book/1", {
      headers: { "user-agent": "Mozilla/5.0 Safari/605.1.15" },
    });

    expect(isVerifiedBotRequest(request)).toBe(false);
  });
});
