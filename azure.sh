#!/usr/bin/env bash
#
# azure.sh — ONE script: git → build → Azure → DNS → bind → verify.
# Final stack: Azure App Service (D1/B1) + Atlas M0 + Redis Cloud free,
# API on sbd.satym.in.
#
# Secrets are NEVER stored in this file — export them in your shell before
# running if you want them set (all optional now; missing = skipped with warning).
#   ./azure.sh            # everything (phase=full)
#   ./azure.sh build      # only: git pull + docker build + push
#   ./azure.sh provision  # only: Azure RG/plan/app/settings/image
#   ./azure.sh bind       # only: attach custom domain (after DNS added)
#   ./azure.sh verify     # only: re-run health checks
#   ./azure.sh all        # provision + bind (no build)
#
# Optional env (all skipped if empty):
#   MONGODB_URI        Atlas M0 connection string
#   FRONTEND_ORIGINS   e.g. https://app.satym.in
# Optional env:
#   GHCR_IMAGE         auto-derived from git remote if empty
#   REDIS_URL          Redis Cloud URI (recommended)
#   SESSION_SECRET     empty = generated + saved to .azure-secret.local
#   EXTRA_SETTINGS     "KEY=v KEY2=v2" (Google/AI/mail keys; quote values with spaces)
#   DOCKER_PAT         GitHub PAT (packages:read+write); else assumes docker logged in
#   GH_OWNER           GitHub username (lowercase); auto-derived if empty
#
#   export MONGODB_URI='...' FRONTEND_ORIGINS='https://app.satym.in' \
#     REDIS_URL='...' EXTRA_SETTINGS='...' DOCKER_PAT='...'
#   ./azure.sh
#
# Phases build|provision|bind|verify|all|full map 1:1 onto
# scripts/azure-setup.sh — this file only adds: repo checkout,
# tool/login prep, GHCR_IMAGE auto-derivation, optional dep install.
set -euo pipefail

# ---------------- CONFIG (non-secret defaults only) ----------------
PHASE="${1:-full}"
REPO_URL="${REPO_URL:-https://github.com/satyamsingh5512/StudyBuddy.git}"
DIR="${DIR:-StudyBuddy}"               # clone target when starting outside a repo
APP="${APP:-studybuddy-api}"           # globally unique
RG="${RG:-studybuddy-rg}"
LOC="${LOC:-centralindia}"
PLAN="${PLAN:-studybuddy-plan}"
TIER="${TIER:-B1}"                     # D1 or B1 (F1 blocks custom domains)
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-sbd.satym.in}"
INSTALL_DEPS="${INSTALL_DEPS:-0}"     # =1 → apt install git/docker/curl/openssl (+az CLI if missing)
SKIP_DNS_WAIT="${SKIP_DNS_WAIT:-0}"
MAKE_SP="${MAKE_SP:-0}"                # =1 → also print GitHub-deploy service principal JSON
# ----------------------------------------------------------

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# 0. Be inside the repo: clone it if this script runs standalone elsewhere.
if [ ! -x scripts/azure-setup.sh ]; then
  [ -z "${AZURE_SH_RELOCATED:-}" ] || die "scripts/azure-setup.sh still missing — commit+push azure.sh and scripts/azure-setup.sh, then re-run"
  command -v git >/dev/null 2>&1 || die "git missing and scripts/azure-setup.sh not found — install git or run from repo root"
  if [ ! -d "$DIR/.git" ]; then
    log "Cloning $REPO_URL → ./$DIR"
    git clone "$REPO_URL" "$DIR"
  fi
  # Fresh GitHub clone lacks files you haven't pushed yet (like this one).
  # Carry the running script — and the engine beside it, if present — over.
  if [ ! -x "$DIR/azure.sh" ]; then
    log "Carrying local azure.sh (+ engine, if present) into ./$DIR"
    cp -- "$0" "$DIR/azure.sh"
    chmod +x "$DIR/azure.sh"
  fi
  if [ -f scripts/azure-setup.sh ] && [ ! -f "$DIR/scripts/azure-setup.sh" ]; then
    mkdir -p "$DIR/scripts"
    cp scripts/azure-setup.sh "$DIR/scripts/azure-setup.sh"
  fi
  export AZURE_SH_RELOCATED=1
  cd "$DIR"
  log "Re-running from ./$DIR"
  exec bash azure.sh "$PHASE"
fi

# 1. Optional dependency install (Ubuntu/Debian).
if [ "$INSTALL_DEPS" = "1" ] && command -v apt-get >/dev/null 2>&1; then
  log "Installing deps (git docker.io curl openssl)"
  sudo apt-get update -qq
  sudo apt-get install -y -qq git docker.io curl openssl ca-certificates
  sudo service docker start 2>/dev/null || sudo systemctl start docker 2>/dev/null || true
  command -v az >/dev/null 2>&1 || { log "Installing Azure CLI"; curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash; }
fi

# 2. Tool + login prep.
command -v git >/dev/null 2>&1 || die "git missing (INSTALL_DEPS=1 to auto-install)"
command -v az >/dev/null 2>&1 || die "Azure CLI missing (INSTALL_DEPS=1, or https://aka.ms/InstallAzureCLI)"
az account show >/dev/null 2>&1 || { log "Azure login"; az login; }

# 3. Fresh code.
if [ -d .git ]; then
  log "Pulling latest ($(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?'))"
  git pull --ff-only || echo "WARNING: pull failed — continuing with local code"
fi

# 4. Derive GHCR_IMAGE from git remote when not provided via env.
GHCR_IMAGE="${GHCR_IMAGE:-}"
if [ -z "$GHCR_IMAGE" ]; then
  REMOTE="$(git remote get-url origin 2>/dev/null || echo '')"
  OWNER_REPO="$(printf '%s' "$REMOTE" | sed -E 's#.*github\.com[:/]([^/]+/[^/]+?)(\.git)?/?$#\1#')"
  OWNER_REPO="${OWNER_REPO%.git}" # belt-and-braces: remote URLs end in .git
  if [[ "$OWNER_REPO" == *"/"* ]]; then
    GH_OWNER_DERIVED="$(printf '%s' "$OWNER_REPO" | cut -d/ -f1 | tr '[:upper:]' '[:lower:]')"
    REPO_LC="$(printf '%s' "$OWNER_REPO" | tr '[:upper:]' '[:lower:]' | sed 's/\.git$//')"
    if [[ ! "$REPO_LC" =~ ^[a-z0-9_.-]+/[a-z0-9_.-]+$ ]]; then
      die "cannot derive GHCR_IMAGE from remote '$REMOTE' — export GHCR_IMAGE explicitly, e.g. GHCR_IMAGE=ghcr.io/<owner>/<repo>/studybuddy-api:latest"
    fi
    GHCR_IMAGE="ghcr.io/$REPO_LC/studybuddy-api:latest"
    log "Derived GHCR_IMAGE=$GHCR_IMAGE"
  fi
fi

# 5. Docker registry login for build phases.
case "$PHASE" in
  build|full)
    command -v docker >/dev/null 2>&1 || die "docker missing (INSTALL_DEPS=1 to auto-install)"
    docker info >/dev/null 2>&1 || die "docker daemon not running"
    if [ -n "${DOCKER_PAT:-}" ]; then
      [ -n "${GH_OWNER:-${GH_OWNER_DERIVED:-}}" ] || die "GH_OWNER env required with DOCKER_PAT"
      log "Docker login to ghcr.io as ${GH_OWNER:-$GH_OWNER_DERIVED}"
      printf '%s' "$DOCKER_PAT" | docker login ghcr.io -u "${GH_OWNER:-$GH_OWNER_DERIVED}" --password-stdin
    else
      echo "No DOCKER_PAT — assuming 'docker login ghcr.io' was already done."
    fi
    ;;
esac

# 6. Hand off to the engine with everything exported.
# Secrets come from YOUR environment only — nothing secret lives in this file.
export APP RG LOC PLAN TIER CUSTOM_DOMAIN INSTALL_DEPS SKIP_DNS_WAIT MAKE_SP
export GHCR_IMAGE="${GHCR_IMAGE:-}"
export MONGODB_URI="${MONGODB_URI:-}"
export REDIS_URL="${REDIS_URL:-}"
export SESSION_SECRET="${SESSION_SECRET:-}"
export FRONTEND_ORIGINS="${FRONTEND_ORIGINS:-}"
export EXTRA_SETTINGS="${EXTRA_SETTINGS:-}"
log "Phase: $PHASE (app=$APP tier=$TIER domain=$CUSTOM_DOMAIN image=${GHCR_IMAGE:-<unset>})"
exec bash scripts/azure-setup.sh "$PHASE"
