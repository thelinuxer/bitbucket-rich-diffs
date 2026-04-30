# Releasing

A release is triggered by pushing a `v*` git tag. GitHub Actions does the rest.

## Prerequisites (one-time)

- AMO developer account at https://addons.mozilla.org/
- API credentials generated at https://addons.mozilla.org/developers/addon/api/key/
- The credentials added to this repo's GitHub secrets:
  - `AMO_JWT_ISSUER` — the JWT issuer key
  - `AMO_JWT_SECRET` — the JWT secret

## Cutting a release

1. Bump `version` in `manifest.json` (must match the tag — the workflow refuses to run on a mismatch).
2. Commit the bump (e.g. `release: bump to 0.1.1`).
3. Tag and push:
   ```
   git tag v0.1.1
   git push origin main --tags
   ```
4. The `Release` workflow will:
   - Verify the manifest version matches the tag.
   - Lint the extension with `web-ext lint`.
   - Build a `bitbucket-rich-diffs-vX.Y.Z.zip` source bundle.
   - Submit to AMO via `web-ext sign --channel=listed`.
   - Create a GitHub release with the zip attached and auto-generated notes.

## First AMO submission

The first submission creates the addon listing on AMO with only the metadata in `manifest.json` (name, description, version). After the first run completes, log into AMO and fill in:

- A longer description
- Screenshots
- Categories and tags
- Support / homepage URLs
- License information

Subsequent releases reuse that listing — only the new version gets uploaded.

Listed-channel submissions are reviewed by Mozilla before going live. The CI step succeeds once the upload is accepted; actual publication happens after review.

## If something fails

- The **AMO submission step is `continue-on-error`**, so a failure there won't block the GitHub release. Check the Actions log for the specific reason (most common: version already submitted, or invalid credentials).
- The **GitHub release step uses `if: always()`** so the zip artifact is published even if AMO failed.
- To re-submit to AMO without a new git tag, bump the version and tag again — AMO won't accept the same version twice.
