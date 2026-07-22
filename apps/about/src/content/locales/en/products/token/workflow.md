Treat the token like a password. The safe handoff keeps the secret outside the AI conversation.

1. The agent asks for a dedicated workspace and explains which files and commands it will use.
2. The agent may create an empty `.env` file and add it to `.gitignore`, but stops before any credential is entered.
3. The user enters `REZICS_API_TOKEN` locally. Do not paste the token into an AI chat: giving it directly to an AI creates an unavoidable disclosure risk.
4. Code reads the token only from the process environment. It must never print it, include it in a URL, write it to logs, or commit it.
5. Begin with the smallest permission set and the Standard policy. The safe token self-inspection endpoint can report identity, permissions, and effective limits without returning the token or another secret.
6. Automation uses bounded batches, checkpoints, and backoff. The user disables or revokes the token when the task is complete.
