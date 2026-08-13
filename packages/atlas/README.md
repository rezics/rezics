# `@rezics/atlas`

`@rezics/atlas` is the platform adapter for the Atlas CLI used by REZICS database tasks. It
does not contain or modify the Atlas binary.

- On Linux and macOS, it runs the exact `@ariga/atlas` version declared in this package.
- On Windows, it runs a native `atlas.exe` from `REZICS_ATLAS_BINARY` or the first non-wrapper
  `atlas.exe` on `PATH`.
- Windows accepts the repository baseline or a newer stable version in the same Atlas major release.
  CI and production continue to use the exact optional-dependency version.
- Every invocation verifies the native CLI compatibility before forwarding arguments.

`REZICS_ATLAS_BINARY`, when set on Windows, must be an absolute path to an `.exe`. The adapter
passes arguments directly to the executable without a shell and never logs command arguments,
which may contain database credentials.

The Atlas binary is distributed by Ariga under its own license. Installing or using Atlas is
subject to Ariga's applicable terms.
