#!/usr/bin/env bash
#
# StudyBuddy backend → Azure App Service + custom domain (sbd.satym.in).
# Stack: Azure App Service (D1/B1) + MongoDB Atlas M0 + Redis Cloud free.
#
# NOTE: Azure F1 Free CANNOT bind custom domains (Azure blocks it), so this
# script requires TIER=D1 (Shared, cheapest with custom domains) or B1
# (recommended: Always-On + free managed certificate via portal).
#
# Usage (everything via shell — pick one):
#   ./scripts/azure-setup.sh full        # build+push image, provision, DNS pause, bind, verify (needs docker)
#   ./scripts/azure-setup.sh all         # provision + prompt + bind (default; image must already be pushed)
#   ./scripts/azure-setup.sh build       # only: docker build + push $GHCR_IMAGE (needs docker + PAT login)
#   ./scripts/azure-setup.sh provision   # RG, plan, webapp, settings, image, health check
#   # ... add the printed DNS records at your DNS provider, then:
#   ./scripts/azure-setup.sh bind        # attach sbd.satym.in, verify, health check
#   ./scripts/azure-setup.sh verify      # only: re-run all health/endpoint checks
#
# Config via env (all optional now — missing values are skipped with a warning):
#   APP                Web app name, globally unique (default: studybuddy-api)
#   RG                 Resource group (default: studybuddy-rg)
#   LOC                Azure region (default: centralindia)
#   PLAN               App Service plan name (default: studybuddy-plan)
#   TIER               D1 or B1 (default: B1)
#   CUSTOM_DOMAIN      (default: sbd.satym.in)
#   GHCR_IMAGE         e.g. ghcr.io/<owner>/<repo>/studybuddy-api:latest (optional: skipped if empty)
#   MONGODB_URI        Atlas M0 connection string (optional: skipped if empty, /ready will warn)
#   REDIS_URL          Redis Cloud URI (optional)
#   SESSION_SECRET     32+ bytes (optional: generated + saved to .azure-secret.local)
#   FRONTEND_ORIGINS   comma-separated browser origins, e.g. https://app.satym.in (optional)
#   EXTRA_SETTINGS     optional keys, space-separated KEY=value (no spaces in values):
#                      "GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GROQ_API_KEY=... OPENROUTER_API_KEY=...
#                       EMAIL_FROM=... RESEND_API_KEY=... ADMIN_EMAIL=... NEXT_PUBLIC_ADMIN_EMAIL=...
#                       GOOGLE_CALLBACK_URL=... GROQ_MODEL=... GROQ_MENTOR_MODEL=... GROQ_SCHEDULE_MODEL=...
#                       OPENROUTER_MODEL=... OPENROUTER_MENTOR_MODEL=... NEXT_PUBLIC_APP_URL=...
#                       ZEPTOMAIL_SMTP_USER=... ZEPTOMAIL_SMTP_PASSWORD=... ZEPTOMAIL_SMTP_HOST=... ZEPTOMAIL_SMTP_PORT=..."
#                      Any key left out simply disables that feature (see header table below).
#   SKIP_DNS_WAIT=1    non-interactive: stop after printing DNS records
#   MAKE_SP=1          also create GitHub-deploy service principal (prints secret once)
set -euo pipefail

PHASE="${1:-all}"
APP="${APP:-studybuddy-api}"
RG="${RG:-studybuddy-rg}"
LOC="${LOC:-centralindia}"
PLAN="${PLAN:-studybuddy-plan}"
TIER="${TIER:-B1}"
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-sbd.satym.in}"
GHCR_IMAGE="${GHCR_IMAGE:-}"
MONGODB_URI="${MONGODB_URI:-}"
REDIS_URL="${REDIS_URL:-}"
SESSION_SECRET="${SESSION_SECRET:-}"
FRONTEND_ORIGINS="${FRONTEND_ORIGINS:-}"
EXTRA_SETTINGS="${EXTRA_SETTINGS:-}"

log()  { printf '\n==> %s\n' "$*"; }
die()  { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
need() { local v="$1" msg="$2"; [ -n "$v" ] || die "$msg"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

check_prereqs() {
  need_cmd az
  need_cmd curl
  need_cmd openssl
  az account show >/dev/null 2>&1 || die "run 'az login' first"
  case "$TIER" in
    D1|B1) ;;
    *) die "TIER must be D1 or B1 for custom domains (F1 Free blocks them). Got: $TIER" ;;
  esac
  # All env vars are optional — warn only, never fail.
  [ -n "$GHCR_IMAGE" ] || echo "WARNING: GHCR_IMAGE empty — container steps will be skipped."
  [ -n "$MONGODB_URI" ] || echo "WARNING: MONGODB_URI empty — app will run without DB (/ready will fail) until you set it."
  [ -n "$FRONTEND_ORIGINS" ] || echo "WARNING: FRONTEND_ORIGINS empty — CORS settings will be skipped."
}

ensure_secret() {
  if [ -z "$SESSION_SECRET" ]; then
    SESSION_SECRET="$(openssl rand -hex 32)"
    umask 077
    printf '%s' "$SESSION_SECRET" > .azure-secret.local
    log "Generated SESSION_SECRET → saved to .azure-secret.local (keep it safe; rotating it logs all users out)"
  fi
}

provision() {
  log "Resource group $RG ($LOC)"
  az group create -n "$RG" -l "$LOC" -o none

  log "App Service plan $PLAN ($TIER)"
  if az appservice plan show -g "$RG" -n "$PLAN" >/dev/null 2>&1; then
    az appservice plan update -g "$RG" -n "$PLAN" --sku "$TIER" -o none
  else
    az appservice plan create -g "$RG" -n "$PLAN" --sku "$TIER" --is-linux -o none
  fi

  log "Web app $APP"
  if ! az webapp show -g "$RG" -n "$APP" >/dev/null 2>&1; then
    if ! az webapp check-name -n "$APP" --query available -o tsv | grep -qi true; then
      die "app name '$APP' is taken globally — set APP= to a unique name"
    fi
    if [ -n "$GHCR_IMAGE" ]; then
      az webapp create -g "$RG" -p "$PLAN" -n "$APP" \
        --container-image-name "$GHCR_IMAGE" -o none
    else
      az webapp create -g "$RG" -p "$PLAN" -n "$APP" --runtime "NODE:22-lts" -o none
    fi
  fi

  CLIENT_URL="${FRONTEND_ORIGINS%%,*}"
  log "App settings (PORT, NODE_ENV + whatever env was provided)"
  # EXTRA_SETTINGS is space-separated KEY=value; values WITH spaces must be
  # double-quoted, e.g. EXTRA_SETTINGS='EMAIL_FROM="StudyBuddy <noreply@satym.in>" GROQ_API_KEY=gsk_...'
  # (eval is used only on your own input to honor those quotes).
  EXTRA_ARR=()
  if [ -n "$EXTRA_SETTINGS" ]; then
    # shellcheck disable=SC2086
    eval "EXTRA_ARR=($EXTRA_SETTINGS)"
  fi
  SETTINGS=(
    WEBSITES_PORT=8080
    PORT=8080
    NODE_ENV=production
  )
  [ -n "$MONGODB_URI" ] && SETTINGS+=(MONGODB_URI="$MONGODB_URI")
  [ -n "$SESSION_SECRET" ] && SETTINGS+=(SESSION_SECRET="$SESSION_SECRET")
  [ -n "$REDIS_URL" ] && SETTINGS+=(REDIS_URL="$REDIS_URL")
  [ -n "$FRONTEND_ORIGINS" ] && SETTINGS+=(ALLOWED_ORIGINS="$FRONTEND_ORIGINS")
  [ -n "$CLIENT_URL" ] && SETTINGS+=(CLIENT_URL="$CLIENT_URL")
  SETTINGS+=("${EXTRA_ARR[@]}")
  az webapp config appsettings set -g "$RG" -n "$APP" --settings \
    "${SETTINGS[@]}" \
    -o none

  if [ -n "$GHCR_IMAGE" ]; then
    log "Container image → $GHCR_IMAGE"
    az webapp config container set -g "$RG" -n "$APP" \
      --container-image-name "$GHCR_IMAGE" \
      --container-registry-url https://ghcr.io -o none
  else
    echo "Skipping container image (GHCR_IMAGE empty)."
  fi
  az webapp log config -g "$RG" -n "$APP" --docker-container-logging filesystem -o none
  az webapp restart -g "$RG" -n "$APP" -o none

  if [ "${MAKE_SP:-0}" = "1" ]; then
    SUB_ID="$(az account show --query id -o tsv)"
    log "Service principal for GitHub Actions (SECRET SHOWN ONCE — save as AZURE_CREDENTIALS)"
    az ad sp create-for-rbac --name studybuddy-deploy --role contributor \
      --scopes "/subscriptions/$SUB_ID/resourceGroups/$RG" --sdk-auth
  fi

  AZURE_URL="https://$APP.azurewebsites.net"
  log "Waiting for $AZURE_URL/api/health/live (cold start can take minutes)"
  for i in $(seq 1 30); do
    if curl -fsS --max-time 10 "$AZURE_URL/api/health/live" >/dev/null 2>&1; then
      echo "LIVE on attempt $i"
      break
    fi
    echo "attempt $i/30 …"; sleep 10
    [ "$i" = "30" ] && die "app never became live — run: az webapp log tail -g $RG -n $APP"
  done
  curl -fsS --max-time 15 "$AZURE_URL/api/health/ready" || \
    echo "WARNING: /ready not OK (usually Atlas IP allow-list) — app still serves, fix Atlas Network Access → 0.0.0.0/0"
}

dns_info() {
  VERIF_ID="$(az webapp show -g "$RG" -n "$APP" --query customDomainVerificationId -o tsv)"
  # TXT host is relative to the parent zone: asuid.<sub> for subdomains.
  SUB="${CUSTOM_DOMAIN%%.*}"
  cat <<EOF

----- ADD THESE DNS RECORDS (at your satym.in DNS provider) -----
TXT   asuid.$SUB   $VERIF_ID
CNAME $SUB         $APP.azurewebsites.net
------------------------------------------------------------------
(If DNS is on Cloudflare: proxy OFF until the bind succeeds, then you may re-enable it.)
EOF
}

wait_for_dns() {
  if [ "${SKIP_DNS_WAIT:-0}" = "1" ]; then
    echo "SKIP_DNS_WAIT=1 → stopping here. Re-run with 'bind' after adding DNS."
    exit 0
  fi
  SUB="${CUSTOM_DOMAIN%%.*}"
  echo "Press ENTER after adding the DNS records above (or Ctrl+C to stop and run './scripts/azure-setup.sh bind' later)."
  read -r _
  echo "Checking TXT propagation (best-effort)…"
  for i in $(seq 1 12); do
    if command -v dig >/dev/null 2>&1; then
      dig +short TXT "asuid.$SUB.satym.in" 2>/dev/null | grep -q . && { echo "TXT visible"; return 0; }
    elif command -v nslookup >/dev/null 2>&1; then
      nslookup -type=TXT "asuid.$SUB.satym.in" 2>/dev/null | grep -qi "text\|verif" && { echo "TXT visible"; return 0; }
    else
      echo "no dig/nslookup — skipping propagation check"; return 0
    fi
    echo "not visible yet ($i/12)…"; sleep 10
  done
  echo "TXT not visibly propagated — continuing anyway (Azure will report the real status)."
}

bind() {
  log "Binding $CUSTOM_DOMAIN"
  az webapp config hostname add -g "$RG" --webapp-name "$APP" --hostname "$CUSTOM_DOMAIN"

  log "Waiting for https://$CUSTOM_DOMAIN/api/health/live"
  for i in $(seq 1 30); do
    if curl -fsS --max-time 10 "https://$CUSTOM_DOMAIN/api/health/live" >/dev/null 2>&1; then
      echo "CUSTOM DOMAIN LIVE on attempt $i"
      break
    fi
    echo "attempt $i/30 …"; sleep 10
    [ "$i" = "30" ] && die "domain not serving — check DNS + 'az webapp config hostname list -g $RG --webapp-name $APP'"
  done

  cat <<EOF

----- DONE -----
API:      https://$CUSTOM_DOMAIN
Azure URL (fallback): https://$APP.azurewebsites.net

TLS next step (pick one):
  B1 → Portal → Web App → Certificates → Add managed certificate (free) for $CUSTOM_DOMAIN
  D1 → keep Cloudflare proxy ON in front of $CUSTOM_DOMAIN (browser TLS from Cloudflare, SSL mode Full)
Update your frontend's BACKEND_API_URL to https://$CUSTOM_DOMAIN
EOF
}

build() {
  need_cmd docker
  docker info >/dev/null 2>&1 || die "docker daemon is not running"
  if [ -z "$GHCR_IMAGE" ]; then
    GHCR_IMAGE="ghcr.io/studybuddy-local/studybuddy-api:latest"
    echo "WARNING: GHCR_IMAGE empty — using default $GHCR_IMAGE"
  fi
  log "Building $GHCR_IMAGE"
  docker build -f backend/Dockerfile -t "$GHCR_IMAGE" ./backend
  log "Pushing $GHCR_IMAGE"
  docker push "$GHCR_IMAGE"
  cat <<EOF

Image pushed. One manual click (GitHub has no CLI-free way around it):
  GitHub → profile → Packages → studybuddy-api → Settings → Change visibility → Public
(private works too, but then add DOCKER_REGISTRY_SERVER_URL/USERNAME/PASSWORD app settings)
EOF
}

verify() {
  AZURE_URL="https://$APP.azurewebsites.net"
  BASE="https://$CUSTOM_DOMAIN"
  pass=0; fail=0
  check() {
    if curl -fsS --max-time 15 "$1" >/dev/null 2>&1; then echo "PASS $1"; pass=$((pass+1));
    else echo "FAIL $1"; fail=$((fail+1)); fi
  }
  log "Verify via Azure URL"
  check "$AZURE_URL/api/health/live"
  check "$AZURE_URL/api/health/ready"
  log "Verify via custom domain"
  check "$BASE/api/health/live"
  check "$BASE/api/health/ready"
  check "$BASE/api/notices"
  check "$BASE/api/users/leaderboard"
  echo "---- $pass passed, $fail failed ----"
  [ "$fail" = "0" ] || die "some checks failed — run: az webapp log tail -g $RG -n $APP"
}

# build/verify don't need Azure env; the rest do.
case "$PHASE" in
  build)  need_cmd docker; build ;;
  verify) need_cmd curl; verify ;;
  provision)
    check_prereqs; ensure_secret; provision; dns_info ;;
  bind)
    check_prereqs; bind ;;
  all)
    check_prereqs; ensure_secret; provision; dns_info; wait_for_dns; bind ;;
  full)
    need_cmd docker; check_prereqs; ensure_secret
    build; provision; dns_info; wait_for_dns; bind; verify ;;
  *) die "unknown phase '$PHASE' — use: build | provision | bind | verify | all | full" ;;
esac
