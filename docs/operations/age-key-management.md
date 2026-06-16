# age Key Management (SOPS Secrets)

Production secrets live in SOPS-encrypted per-unit files
(`config/secrets/<unit>.enc.env`) committed to the repo. They are encrypted to
an **age** recipient and decrypted at deploy time with the matching age private
key held only by the CI runner / operator.

## Bootstrap

```bash
# 1. Generate the key pair (PRIVATE key file is gitignored — store it safely).
age-keygen -o sops-age.key
#   -> public key: age1xxxxxxxx...

# 2. Put the PUBLIC key into .sops.yaml `age:` (replace the placeholder).

# 3. Encrypt each unit's secrets from its template:
for unit in common server auth notify reaction history ranking job-runner infra; do
  cp "config/secrets/${unit}.env.example" "config/secrets/${unit}.enc.env"
  $EDITOR "config/secrets/${unit}.enc.env"          # fill real values
  sops --encrypt --in-place "config/secrets/${unit}.enc.env"
done

# 4. Commit only the encrypted *.enc.env. Never commit plaintext or sops-age.key.
```

## Deploy-time decryption

The deploy runner needs the private key in the environment:

```bash
export SOPS_AGE_KEY_FILE=$PWD/sops-age.key      # operator
# or, in GitHub Actions, SOPS_AGE_KEY is a protected Environment secret.
```

`bin/nomad-sync-secrets` decrypts each `config/secrets/<unit>.enc.env` and syncs
the values to Nomad Variables. `bin/nomad-deploy <sha> secrets` runs this step
as part of the deploy sequence.

## Rotation

- **Add/replace a recipient** (e.g. new operator or CI key): update the `age:`
  list in `.sops.yaml`, then re-encrypt to the new recipient set:

  ```bash
  sops updatekeys config/secrets/*.enc.env
  ```

- **Rotate a secret value**: `sops config/secrets/<unit>.enc.env` (edit in
  place, re-encrypts on save), commit, redeploy the affected unit. Treat any
  value exposed in plaintext or git history as compromised and rotate it at the
  source (DB password, API key, etc.).

## Break-glass recovery

- **Lost private key:** you cannot decrypt existing files. Generate a new key,
  update `.sops.yaml`, and recreate each `*.enc.env` from the live secret
  sources (DB passwords, provider keys). Until then, deploys that need secrets
  will fail — runtime services already running are unaffected (Nomad Variables
  persist independently).
- **Leaked private key:** rotate every secret value (treat all as exposed),
  generate a fresh age key, `sops updatekeys`, and force-redeploy all units.
- Keep at least two recipients (CI + an offline operator key) so a single lost
  key never blocks deployment.
