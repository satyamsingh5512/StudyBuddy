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
#   APP           Web app name (default: studybuddy-api-20260914)
#   FORCE_BUILD   =1 → build+push locally even if CI already pushed this commit
#   RG            Resource group (default: studybuddy-rg)
#   GHCR_IMAGE    default: derived from git remote, tag = short commit SHA
#   GH_OWNER      GitHub owner/org (lowercase); auto-derived if empty
#   DOCKER_PAT    GitHub PAT (packages:read+write); skip if already `docker login ghcr.io`
#
# Requires: git, docker (daemon running), az (logged in — `az login`).
# Secrets are NOT read or written by this script — app settings are untouched.
set -euo pipefail

APP="${APP:-studybuddy-api-20260914}"
RG="${RG:-studybuddy-rg}"
FORCE_BUILD="${FORCE_BUILD:-0}"   # =1 → always build+push locally, even if CI already pushed this commit

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# Log in to ghcr.io with push rights, or die with the exact fix.
# Order: DOCKER_PAT → existing docker login → gh CLI token (if it has write:packages).
ghcr_login() {
  local user="$1"
  if [ -n "${DOCKER_PAT:-}" ]; then
    [ -n "$user" ] || die "GH_OWNER env required with DOCKER_PAT"
    log "Docker login to ghcr.io as $user (DOCKER_PAT)"
    printf '%s' "$DOCKER_PAT" | docker login ghcr.io -u "$user" --password-stdin
    return
  fi
  if grep -qs '"ghcr.io"' "${DOCKER_CONFIG:-$HOME/.docker}/config.json"; then
    echo "Using existing 'docker login ghcr.io' credentials."
    return
  fi
  gh_status="$(command -v gh >/dev/null 2>&1 && gh auth status 2>&1 || true)"
  if [[ "$gh_status" == *write:packages* ]]; then
    log "Docker login to ghcr.io via gh CLI token"
    gh auth token | docker login ghcr.io -u "${user:-$(gh api user --jq .login)}" --password-stdin
    return
  fi
  die "no GHCR push credentials. Fix once with:
    gh auth refresh -h github.com -s write:packages
  then re-run (or export DOCKER_PAT=<classic PAT with write:packages>)."
}

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

# Skip entirely when the backend source is identical to what is already running.
# Most commits here touch only the web/Android code, which Vercel and the APK ship;
# rebuilding an identical Go image just restarts the API for nothing.
DEPLOYED_TAG="$(az webapp show -g "$RG" -n "$APP" --query siteConfig.linuxFxVersion -o tsv 2>/dev/null | sed -E 's#.*:##')"
if [ "$FORCE_BUILD" != "1" ] && [ -n "$DEPLOYED_TAG" ] \
  && git rev-parse --verify --quiet "${DEPLOYED_TAG}^{commit}" >/dev/null \
  && git diff --quiet "$DEPLOYED_TAG" HEAD -- backend; then
  log "backend/ is unchanged since the running image ($DEPLOYED_TAG) — nothing to redeploy"
  echo "(FORCE_BUILD=1 ./redeploy.sh to rebuild and restart anyway)"
  exit 0
fi

# Registry calls can be reset mid-handshake (seen over VPN tunnels such as
# Cloudflare WARP). Retry with a short backoff instead of failing the deploy.
retry() {
  local attempt
  for attempt in 1 2 3 4; do
    "$@" && return 0
    [ "$attempt" = 4 ] && return 1
    echo "attempt $attempt failed — retrying in $((attempt * 5))s …"
    sleep $((attempt * 5))
  done
}

# 2. Derive GHCR_IMAGE (tag by commit SHA so each redeploy is traceable and
# rollback-able; ':latest' is also pushed so other tooling that expects it
# keeps working).
GHCR_IMAGE="${GHCR_IMAGE:-}"
if [ -z "$GHCR_IMAGE" ]; then
  REMOTE="$(git remote get-url origin 2>/dev/null || echo '')"
  OWNER_REPO="$(printf '%s' "$REMOTE" | sed -E 's#.*github\.com[:/]([^/]+/[^/]+)/?$#\1#; s#\.git$##')"
  # ERE has no non-greedy '+?', so '.git' is stripped in a second expression.
  # Keeping it once pointed Azure at a private '.../studybuddy.git/...' image → 503.
  [[ "$OWNER_REPO" == *"/"* ]] || die "cannot derive image from remote '$REMOTE' — set GHCR_IMAGE explicitly"
  GH_OWNER_DERIVED="$(printf '%s' "$OWNER_REPO" | cut -d/ -f1 | tr '[:upper:]' '[:lower:]')"
  REPO_LC="$(printf '%s' "$OWNER_REPO" | tr '[:upper:]' '[:lower:]')"
  [[ "$REPO_LC" =~ ^[a-z0-9_.-]+/[a-z0-9_.-]+$ ]] || die "cannot derive image from remote '$REMOTE' — set GHCR_IMAGE explicitly"
  GHCR_IMAGE="ghcr.io/$REPO_LC/studybuddy-api"
fi
IMAGE_REPO="${GHCR_IMAGE%%:*}"
IMAGE_LATEST_TAG="$IMAGE_REPO:latest"

# 3. Reuse the image GitHub Actions already pushed for this commit
# (.github/workflows/azure-backend.yml tags it with the full SHA). That needs
# no local push credentials at all.
CI_IMAGE="$IMAGE_REPO:$(git rev-parse HEAD)"
if [ "$FORCE_BUILD" != "1" ] && timeout 60 docker manifest inspect "$CI_IMAGE" >/dev/null 2>&1; then
  IMAGE_SHA_TAG="$CI_IMAGE"
  log "CI already pushed $IMAGE_SHA_TAG — skipping local build/push (FORCE_BUILD=1 to override)"
else
  IMAGE_SHA_TAG="$IMAGE_REPO:$COMMIT_SHA"
  log "Image: $IMAGE_SHA_TAG (+ latest)"

  # 4. Registry login, then build + push.
  ghcr_login "${GH_OWNER:-${GH_OWNER_DERIVED:-}}"
  log "Building $IMAGE_SHA_TAG"
  docker build -f backend/Dockerfile -t "$IMAGE_SHA_TAG" -t "$IMAGE_LATEST_TAG" ./backend
  log "Pushing $IMAGE_SHA_TAG"
  retry docker push "$IMAGE_SHA_TAG" || die "push of $IMAGE_SHA_TAG failed 4 times — check network/VPN, then re-run"
  log "Pushing $IMAGE_LATEST_TAG"
  retry docker push "$IMAGE_LATEST_TAG" || die "push of $IMAGE_LATEST_TAG failed 4 times — check network/VPN, then re-run"
fi

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
