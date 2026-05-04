# Releasing

A release is triggered by pushing a `v*` git tag. GitHub Actions builds per-browser packages, submits them to the respective stores, and creates a GitHub release with the zip artifacts attached.

## Prerequisites (one-time)

### AMO (Firefox)

- AMO developer account at https://addons.mozilla.org/
- API credentials generated at https://addons.mozilla.org/developers/addon/api/key/
- Repo secrets:
  - `AMO_JWT_ISSUER` — JWT issuer key
  - `AMO_JWT_SECRET` — JWT secret

### Chrome Web Store

- Chrome Web Store developer account ($5 one-time fee paid at https://chrome.google.com/webstore/devconsole)
- One **manual** publish required first to receive the extension ID — upload `dist/bitbucket-rich-diffs-chrome-vX.Y.Z.zip` (built locally via `scripts/build.sh --zip`) at https://chrome.google.com/webstore/devconsole
- After the first manual publish, generate API credentials:
  1. Google Cloud Console → enable the **Chrome Web Store API**
  2. Create an OAuth 2.0 client (type: Desktop app)
  3. Run the OAuth flow once to get a **refresh token** (e.g. via `https://github.com/fregante/chrome-webstore-upload-cli` or any of the documented one-shot scripts)
- Repo secrets:
  - `CWS_CLIENT_ID`
  - `CWS_CLIENT_SECRET`
  - `CWS_REFRESH_TOKEN`
  - `CWS_EXTENSION_ID` — the ID Chrome assigned after the first manual upload
- Optional repo variable (not secret):
  - `CWS_PUBLISH_TARGET` — `default` (public) or `trustedTesters`. Default: `default`.

The Chrome submission step is gated on `CWS_REFRESH_TOKEN` and `CWS_EXTENSION_ID` being set. Without them, the step prints "Chrome Web Store secrets not configured; skipping." and the rest of the workflow continues — useful while you're still doing the first manual upload.

## Cutting a release

The version field in the committed manifests is a placeholder (`0.0.0`). The build script rewrites it from the git tag at build time, so there's no manifest bump to do — just tag.

1. Tag and push:
   ```
   git tag v0.1.7
   git push origin v0.1.7
   ```
2. The workflow will:
   - Run `scripts/build.sh --version "${GITHUB_REF_NAME#v}" --zip` to produce `dist/firefox`, `dist/chrome`, and `dist/bitbucket-rich-diffs-{firefox,chrome}-vX.Y.Z.zip`. The manifest's `version` field is rewritten to match the tag during the build.
   - Run `web-ext lint` on `dist/firefox`.
   - Submit the Firefox build to AMO via `web-ext sign --channel=listed`.
   - If Chrome secrets are configured, upload the Chrome build to the Chrome Web Store and publish.
   - Create a GitHub release with both zips attached and auto-generated notes.

Tag names must be `vX.Y.Z` (semver). The build script rejects non-semver versions.

## Local builds

```bash
scripts/build.sh                            # builds dist/firefox/ and dist/chrome/
                                            # version: from current tag, else 0.0.0
scripts/build.sh --version 0.1.7 --zip      # explicit version + per-store zips
scripts/build.sh --browser firefox          # build only one
```

Load the resulting directory:

- **Firefox** — `about:debugging` → **Load Temporary Add-on…** → pick `dist/firefox/manifest.json`
- **Chrome** — `chrome://extensions/` → **Developer mode** → **Load unpacked** → pick `dist/chrome/`

## First store submissions

The very first listing on each store needs metadata that's not in the manifest (long description, screenshots, categories, support URLs, privacy statement). For copy you can paste, see `AMO_LISTING.md` (Firefox) and `CHROME_LISTING.md` (Chrome).

Subsequent releases reuse the listing — only the new version is uploaded.

## If something fails

- Both store-submission steps use `continue-on-error: true`, so a failure on AMO or CWS doesn't block the GitHub release.
- The GitHub release step uses `if: always()`, so the zip artifacts are published even if both stores rejected.
- To re-submit a version that AMO or CWS already accepted, you have to bump the manifest version and re-tag — neither store accepts duplicate version uploads.
