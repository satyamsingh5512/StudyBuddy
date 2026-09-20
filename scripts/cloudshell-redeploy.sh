#!/usr/bin/env bash
#
# cloudshell-redeploy.sh — redeploy the LATEST GitHub commit from Azure Cloud
# Shell, where there is NO Docker daemon. It never builds an image: GitHub
# Actions (.github/workflows/azure-backend.yml) already builds and pushes
# ghcr.io/<owner>/<repo>/studybuddy-api:<full-commit-sha>, so this script only
#
#   1. resolves the latest commit SHA of origin/main from the GitHub API
#   2. confirms that SHA tag actually exists in GHCR (fails loudly if the
#      workflow has not finished — no silent deploy of a stale image)
#   3. az webapp config container set  (pin the web app to that SHA tag)
#   4. az webapp restart              (App Service only re-pulls on restart)
#   5. polls /api/health/live then /api/health/ready
#
# It does NOT create resources, touch app settings (Mongo/Redis/SESSION_SECRET/
# CORS), or bind DNS. Use ./azure.sh for that. It reads no secrets.
#
# Usage (inside Azure Cloud Shell, already `az login`-ed by definition):
#   ./scripts/cloudshell-redeploy.sh              # deploy latest main
#   DRY_RUN=1 ./scripts/cloudshell-redeploy.sh    # resolve + verify only
#   SHA=<full-sha> ./scripts/cloudshell-redeploy.sh   # redeploy/rollback a pin
#
# Config via env (defaults match the live deploy):
#   APP        web app name       (default: studybuddy-api-20260914)
#   RG         resource group     (default: studybuddy-rg)
#   REPO       GitHub owner/repo  (default: satyamsingh5512/StudyBuddy)
#   BRANCH     branch to deploy   (default: main)
#   SHA        pin this exact commit instead of resolving BRANCH
#   IMAGE      GHCR image w/o tag (default: derived from REPO, lowercased)
#   GH_TOKEN   only needed if the GHCR package is private
#   DRY_RUN=1  print what would happen, change nothing
#
# Requires: az (logged in), curl, jq — all preinstalled in Cloud Shell.
set -euo pipefail

APP="${APP:-studybuddy-api-20260914}"
RG="${RG:-studybuddy-rg}"
REPO="${REPO:-satyamsingh5512/StudyBuddy}"
BRANCH="${BRANCH:-main}"
DRY_RUN="${DRY_RUN:-0}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

for t in az curl jq; do
  command -v "$t" >/dev/null 2>&1 || die "$t is required"
done
az account show >/dev/null 2>&1 || die "not logged in to Azure — run: az login"

REPO_LC="$(printf '%s' "$REPO" | tr '[:upper:]' '[:lower:]')"
[[ "$REPO_LC" =~ ^[a-z0-9_.-]+/[a-z0-9_.-]+$ ]] || die "REPO must be owner/repo, got '$REPO'"
IMAGE="${IMAGE:-ghcr.io/$REPO_LC/studybuddy-api}"
IMAGE="${IMAGE%%:*}"                 # tolerate a tag being passed in
GHCR_PATH="${IMAGE#ghcr.io/}"        # repository path used by the registry API

# 1. Latest commit on the branch (or an explicit pin).
GH_AUTH=()
[ -n "${GH_TOKEN:-}" ] && GH_AUTH=(-H "Authorization: Bearer $GH_TOKEN")
if [ -n "${SHA:-}" ]; then
  log "Using pinned commit $SHA"
else
  log "Resolving latest commit of $REPO@$BRANCH"
  SHA="$(curl -fsS "${GH_AUTH[@]}" -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$REPO/commits/$BRANCH" | jq -r '.sha // empty')"
  [ -n "$SHA" ] || die "could not resolve $REPO@$BRANCH from the GitHub API"
fi
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || die "expected a 40-char commit sha, got '$SHA'"
log "Target commit ${SHA:0:7} ($SHA)"

# 2. The image for that commit must already exist in GHCR. If the backend
# workflow is still running (or was skipped because the commit touched no
# backend/** path), stop here instead of restarting onto an unrelated image.
log "Checking $IMAGE:$SHA in GHCR"
if [ -n "${GH_TOKEN:-}" ]; then
  GHCR_TOKEN="$(printf '%s' "$GH_TOKEN" | base64 -w0)"
else
  GHCR_TOKEN="$(curl -fsS "https://ghcr.io/token?scope=repository:$GHCR_PATH:pull&service=ghcr.io" \
    | jq -r '.token // empty')"
  [ -n "$GHCR_TOKEN" ] || die "no anonymous GHCR token — package may be private, set GH_TOKEN"
fi
MANIFEST_ACCEPT='application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'
if ! curl -fsS -o /dev/null -H "Authorization: Bearer $GHCR_TOKEN" -H "Accept: $MANIFEST_ACCEPT" \
     "https://ghcr.io/v2/$GHCR_PATH/manifests/$SHA"; then
  die "$IMAGE:$SHA is not in GHCR yet.
  The backend image is built by GitHub Actions, not here (Cloud Shell has no Docker daemon).
  Either wait for / re-run the workflow:
    https://github.com/$REPO/actions/workflows/azure-backend.yml
  (it only runs automatically when a commit touches backend/** — use 'Run workflow' otherwise),
  or pin a tag that does exist:  SHA=<sha> $0"
fi
log "Image present"

az webapp show -g "$RG" -n "$APP" -o none 2>/dev/null || \
  die "web app '$APP' not found in resource group '$RG' — set APP/RG (az webapp list -o table)"
CURRENT="$(az webapp show -g "$RG" -n "$APP" --query 'siteConfig.linuxFxVersion' -o tsv)"
HOST="$(az webapp show -g "$RG" -n "$APP" --query 'defaultHostName' -o tsv)"
log "Current: ${CURRENT:-<none>}"
log "New:     DOCKER|$IMAGE:$SHA"

if [ "$DRY_RUN" = "1" ]; then
  log "DRY_RUN=1 — nothing changed. Would repoint $APP and restart it."
  exit 0
fi

# 3 + 4. Repoint and restart (a GHCR push alone is invisible to App Service).
log "Repointing $APP"
az webapp config container set -g "$RG" -n "$APP" \
  --container-image-name "$IMAGE:$SHA" \
  --container-registry-url https://ghcr.io -o none
log "Restarting $APP"
az webapp restart -g "$RG" -n "$APP" -o none

# 5. Health.
URL="https://$HOST"
log "Waiting for $URL/api/health/live (cold start can take a few minutes)"
LIVE=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 10 "$URL/api/health/live" >/dev/null 2>&1; then
    echo "LIVE on attempt $i"; LIVE=1; break
  fi
  echo "attempt $i/30 …"; sleep 10
done
[ "$LIVE" = "1" ] || die "never became live — logs: az webapp log tail -g $RG -n $APP
  rollback: SHA=<previous-sha> $0"
curl -fsS --max-time 15 "$URL/api/health/ready" || \
  echo "WARNING: /api/health/ready not OK (usually the Atlas IP allow-list) — check Atlas Network Access"

log "Redeployed ${SHA:0:7} → $APP ($URL)"
