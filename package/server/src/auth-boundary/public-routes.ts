export type PublicAuthRouteOwner = "auth-domain" | "main-domain" | "mixed";

export type PublicAuthRouteClassification = {
  pattern: string;
  owner: PublicAuthRouteOwner;
  public: boolean;
  notes: string;
};

export const publicAuthRouteClassifications = [
  {
    pattern: "/auth/session/refresh",
    owner: "main-domain",
    public: true,
    notes:
      "Main validates the opaque auth session through auth, provisions/checks the main user, and refreshes rezics-session-token.",
  },
  {
    pattern: "/auth/sign-out",
    owner: "mixed",
    public: true,
    notes:
      "Main clears rezics-session-token and proxies auth-owned session invalidation.",
  },
  {
    pattern: "/auth/token",
    owner: "auth-domain",
    public: false,
    notes:
      "Auth session JWT acquisition is internal-only and is not exposed through the main public boundary.",
  },
  {
    pattern: "/auth/session/jwks",
    owner: "auth-domain",
    public: true,
    notes: "Auth/OIDC JWKS. Main /.well-known/jwks.json remains main-only.",
  },
  {
    pattern: "/auth/oauth/*",
    owner: "auth-domain",
    public: true,
    notes:
      "OAuth/OIDC protocol handling remains auth-owned behind the main public boundary.",
  },
  {
    pattern: "/auth/callback/:provider",
    owner: "auth-domain",
    public: true,
    notes: "Social provider callbacks are forwarded to auth-owned handling.",
  },
  {
    pattern: "/auth/admin/*",
    owner: "auth-domain",
    public: true,
    notes:
      "Main forwards opaque auth cookies. Auth enforces auth admin authorization.",
  },
  {
    pattern: "/auth/organization/*",
    owner: "auth-domain",
    public: true,
    notes:
      "Main forwards opaque auth cookies. Auth enforces organization authorization.",
  },
] satisfies PublicAuthRouteClassification[];
