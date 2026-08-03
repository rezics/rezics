# @rezics/api

Type-safe REZICS API client generated from the public OpenAPI contract.

## Install

```sh
npm install @rezics/api
```

## Safe AI-agent setup

Treat an API token like a password. Do not paste it into an AI conversation: giving a token directly to an AI creates an unavoidable disclosure risk.

1. Give the agent a dedicated workspace.
2. Let the agent create an empty `.env` and ensure `.env` is listed in `.gitignore`.
3. Enter the token into `.env` yourself. The agent must stop before this step and must never read, display, log, or commit the value.
4. Start with the smallest permissions and Standard limits. Disable or revoke the token when the work is done.

```dotenv
REZICS_API_TOKEN=
```

```ts
import { apiTokenFromEnv, createRezicsClient, getCurrentApiToken } from "@rezics/api";

const client = createRezicsClient({
	baseUrl: "https://your-rezics-instance.example",
	token: () => apiTokenFromEnv(process.env.REZICS_API_TOKEN),
});

const result = await getCurrentApiToken({ client });
console.log(result.data.permissions);
console.log(result.data.effectivePolicy.limits);
```

With current Node.js versions, load the file locally with `node --env-file=.env app.js`. Never place the token in a command-line argument or URL because both commonly appear in logs and process listings.

Generated operations accept the isolated client through their `client` option. Calls throw a typed `ResponseError` for non-success responses by default; pass `throwOnError: false` to handle the documented status union explicitly.

## License

`@rezics/api` is licensed under the [GNU Affero General Public License v3.0
only](./LICENSE) (`AGPL-3.0-only`). Copyright © 2026 Rezics Inc.
