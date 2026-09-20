#!/usr/bin/env bash
#
# redeploy.sh — redeploy the LATEST GitHub commit to the already-provisioned
# Azure Web App. Use this for routine redeploys; it does NOT touch app
# settings (Mongo/Redis/session secret/CORS), create resources, or bind DNS.
# For first-time setup or infra changes use ./azure.sh (full/provision/bind).
#
# What it does:
#   1. git pull --ff-only origin main   (fails loudly if local commits diverge)
#   2. docker build + push the backend image to GHCR
#   3. az webapp config container set   (repoint at the freshly pushed tag)
#   4. az webapp restart                (force Azure to pull it)
#   5. poll /api/health/live and /api/health/ready
#
# Usage:
#   ./redeploy.sh
#
# Config via env (all optional — sensible defaults match the existing deploy):
#   APP           Web app name (default: studybuddy-api)
#   RG            Resource group (default: studybuddy-rg)
#   GHCR_IMAGE    default: derived from git remote, tag = short commit SHA
#   GH_OWNER      GitHub owner/org (lowercase); auto-derived if empty
#   DOCKER_PAT    GitHub PAT (packages:read+write); skip if already `docker login ghcr.io`
#
# Requires: git, docker (daemon running), az (logged in — `az login`).
# Secrets are NOT read or written by this script — app settings are untouched.
set -euo pipefail

APP="${APP:-studybuddy-api}"
RG="${RG:-studybuddy-rg}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git is required"
command -v docker >/dev/null 2>&1 || die "docker is required"
command -v az >/dev/null 2>&1 || die "Azure CLI is required (https://aka.ms/InstallAzureCLI)"
docker info >/dev/null 2>&1 || die "docker daemon not running (try: sudo systemctl start docker)"
az account show >/dev/null 2>&1 || die "not logged in to Azure — run: az login"

# 1. Fresh code from GitHub main.
if [ ! -d .git ]; then
  die "run this from inside the StudyBuddy repo (no .git found here)"
fi
log "Fetching latest (main)"
git fetch origin main
git pull --ff-only origin main || die "local branch has diverged from origin/main — resolve manually, then re-run"
COMMIT_SHA="$(git rev-parse --short HEAD)"
log "Deploying commit $COMMIT_SHA"

az webapp show -g "$RG" -n "$APP" >/dev/null 2>&1 || \
  die "web app '$APP' not found in resource group '$RG' — run ./azure.sh provision first, or set APP/RG"

# 2. Derive GHCR_IMAGE (tag by commit SHA so each redeploy is traceable and
# rollback-able; ':latest' is also pushed so other tooling that expects it
# keeps working).
GHCR_IMAGE="${GHCR_IMAGE:-}"
if [ -z "$GHCR_IMAGE" ]; then
  REMOTE="$(git remote get-url origin 2>/dev/null || echo '')"
  OWNER_REPO="$(printf '%s' "$REMOTE" | sed -E 's#.*github\.com[:/]([^/]+/[^/]+?)(\.git)?/?$#\1#')"
  [[ "$OWNER_REPO" == *"/"* ]] || die "cannot derive image from remote '$REMOTE' — set GHCR_IMAGE explicitly"
  GH_OWNER_DERIVED="$(printf '%s' "$OWNER_REPO" | cut -d/ -f1 | tr '[:upper:]' '[:lower:]')"
  REPO_LC="$(printf '%s' "$OWNER_REPO" | tr '[:upper:]' '[:lower:]')"
  [[ "$REPO_LC" =~ ^[a-z0-9_.-]+/[a-z0-9_.-]+$ ]] || die "cannot derive image from remote '$REMOTE' — set GHCR_IMAGE explicitly"
  GHCR_IMAGE="ghcr.io/$REPO_LC/studybuddy-api"
fi
IMAGE_SHA_TAG="${GHCR_IMAGE%%:*}:$COMMIT_SHA"
IMAGE_LATEST_TAG="${GHCR_IMAGE%%:*}:latest"
log "Image: $IMAGE_SHA_TAG (+ latest)"

# 3. Registry login (skip if already logged in).
if [ -n "${DOCKER_PAT:-}" ]; then
  GH_OWNER="${GH_OWNER:-${GH_OWNER_DERIVED:-}}"
  [ -n "$GH_OWNER" ] || die "GH_OWNER env required with DOCKER_PAT"
  log "Docker login to ghcr.io as $GH_OWNER"
  printf '%s' "$DOCKER_PAT" | docker login ghcr.io -u "$GH_OWNER" --password-stdin
else
  echo "No DOCKER_PAT — assuming 'docker login ghcr.io' was already done."
fi

# 4. Build + push.
log "Building $IMAGE_SHA_TAG"
docker build -f backend/Dockerfile -t "$IMAGE_SHA_TAG" -t "$IMAGE_LATEST_TAG" ./backend
log "Pushing $IMAGE_SHA_TAG"
docker push "$IMAGE_SHA_TAG"
log "Pushing $IMAGE_LATEST_TAG"
docker push "$IMAGE_LATEST_TAG"

# 5. Point the Web App at the new image and restart so it actually pulls it.
# (Azure only re-pulls on settings change or restart — pushing to GHCR alone
# is not observed by App Service.)
log "Repointing $APP at $IMAGE_SHA_TAG"
az webapp config container set -g "$RG" -n "$APP" \
  --container-image-name "$IMAGE_SHA_TAG" \
  --container-registry-url https://ghcr.io -o none
log "Restarting $APP"
az webapp restart -g "$RG" -n "$APP" -o none

# 6. Wait for health.
AZURE_URL="https://$APP.azurewebsites.net"
log "Waiting for $AZURE_URL/api/health/live (cold start can take minutes)"
for i in $(seq 1 30); do
  if curl -fsS --max-time 10 "$AZURE_URL/api/health/live" >/dev/null 2>&1; then
    echo "LIVE on attempt $i"
    break
  fi
  echo "attempt $i/30 …"; sleep 10
  [ "$i" = "30" ] && die "app never became live after redeploy — run: az webapp log tail -g $RG -n $APP"
done
curl -fsS --max-time 15 "$AZURE_URL/api/health/ready" || \
  echo "WARNING: /ready not OK (usually Atlas IP allow-list) — app still serves, check Atlas Network Access"

log "Redeployed commit $COMMIT_SHA → $APP ($AZURE_URL)"
