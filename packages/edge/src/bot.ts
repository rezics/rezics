type RequestWithCf = Request & {
  cf?: {
    botManagement?: {
      verifiedBot?: boolean;
    };
  };
};

const SOCIAL_BOT_UA_PATTERNS = [
  /Twitterbot/i,
  /facebookexternalhit/i,
  /LinkedInBot/i,
  /Slackbot/i,
  /Discordbot/i,
  /TelegramBot/i,
  /WhatsApp/i,
  /Googlebot/i,
  /Bingbot/i,
  /DuckDuckBot/i,
];

export function isVerifiedBotRequest(request: Request): boolean {
  const cf = (request as RequestWithCf).cf;
  if (cf?.botManagement?.verifiedBot === true) return true;

  const ua = request.headers.get("user-agent") ?? "";
  return SOCIAL_BOT_UA_PATTERNS.some((pattern) => pattern.test(ua));
}
