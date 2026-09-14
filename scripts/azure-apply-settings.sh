#!/usr/bin/env bash
# Apply StudyBuddy production settings to Azure App Service.
#
# Run from Azure Cloud Shell after exporting values, or run it interactively:
#   bash scripts/azure-apply-settings.sh
#
# Secrets are intentionally not stored in this script. Required blank values
# are requested silently at runtime. Optional values may remain blank.
set -Eeuo pipefail

APP="${APP:-studybuddy-api-20260914}"
RG="${RG:-studybuddy-rg}"
CLIENT_URL="${CLIENT_URL:-https://sbd.satym.in}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-$CLIENT_URL}"
NODE_ENV="${NODE_ENV:-production}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-$CLIENT_URL}"
EMAIL_FROM="${EMAIL_FROM:-StudyBuddy <noreply@satym.in>}"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

command -v az >/dev/null 2>&1 || die "Azure CLI is required. Run this in Azure Cloud Shell."
command -v openssl >/dev/null 2>&1 || die "openssl is required."
az account show >/dev/null 2>&1 || die "Azure CLI is not logged in."
az webapp show --resource-group "$RG" --name "$APP" >/dev/null 2>&1 || \
  die "Azure Web App '$APP' was not found in resource group '$RG'. Set APP/RG if needed."

prompt_secret() {
  local var_name="$1"
  local label="$2"
  local current="${!var_name:-}"
  if [[ -z "$current" ]]; then
    read -r -s -p "Enter $label: " current
    printf '\n' >&2
  fi
  [[ -n "$current" ]] || die "$label is required."
  printf -v "$var_name" '%s' "$current"
}

prompt_optional_secret() {
  local var_name="$1"
  local label="$2"
  local current="${!var_name:-}"
  if [[ -z "$current" && -t 0 ]]; then
    read -r -s -p "Enter $label (press Enter to skip): " current
    printf '\n' >&2
  fi
  printf -v "$var_name" '%s' "$current"
}

# MongoDB is mandatory for process startup. The other three are requested
# because this deployment is intended to enable the requested integrations.
prompt_secret MONGODB_URI "MONGODB_URI"
prompt_secret REDIS_URL "REDIS_URL"
prompt_secret RESEND_API_KEY "RESEND_API_KEY"
prompt_secret OPENROUTER_API_KEY "OPENROUTER_API_KEY"

# Keep the same session secret on reruns. It is never printed.
SECRET_FILE="${SECRET_FILE:-$HOME/.studybuddy-session-secret}"
if [[ -z "${SESSION_SECRET:-}" ]]; then
  if [[ -s "$SECRET_FILE" ]]; then
    SESSION_SECRET="$(<"$SECRET_FILE")"
  else
    SESSION_SECRET="$(openssl rand -hex 32)"
    umask 077
    printf '%s' "$SESSION_SECRET" > "$SECRET_FILE"
  fi
fi
[[ "${#SESSION_SECRET}" -ge 32 ]] || die "SESSION_SECRET must contain at least 32 bytes."

# Optional integrations. They are still sent when supplied, but never echoed.
prompt_optional_secret GEMINI_API_KEY "GEMINI_API_KEY"
prompt_optional_secret GOOGLE_CLIENT_ID "GOOGLE_CLIENT_ID"
prompt_optional_secret GOOGLE_CLIENT_SECRET "GOOGLE_CLIENT_SECRET"
prompt_optional_secret GROQ_API_KEY "GROQ_API_KEY"
prompt_optional_secret OPENROUTER_MODEL "OPENROUTER_MODEL"
prompt_optional_secret GEMINI_MODEL "GEMINI_MODEL"
GOOGLE_CALLBACK_URL="${GOOGLE_CALLBACK_URL:-}"
GROQ_MODEL="${GROQ_MODEL:-}"
GROQ_MENTOR_MODEL="${GROQ_MENTOR_MODEL:-}"
GROQ_SCHEDULE_MODEL="${GROQ_SCHEDULE_MODEL:-}"
OPENROUTER_MENTOR_MODEL="${OPENROUTER_MENTOR_MODEL:-${OPENROUTER_MODEL:-}}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
NEXT_PUBLIC_ADMIN_EMAIL="${NEXT_PUBLIC_ADMIN_EMAIL:-${ADMIN_EMAIL:-}}"
CACHE_DISABLED="${CACHE_DISABLED:-0}"

settings=(
  "WEBSITES_PORT=8080"
  "PORT=8080"
  "NODE_ENV=$NODE_ENV"
  "CLIENT_URL=$CLIENT_URL"
  "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL"
  "ALLOWED_ORIGINS=$ALLOWED_ORIGINS"
  "MONGODB_URI=$MONGODB_URI"
  "REDIS_URL=$REDIS_URL"
  "RESEND_API_KEY=$RESEND_API_KEY"
  "EMAIL_FROM=$EMAIL_FROM"
  "OPENROUTER_API_KEY=$OPENROUTER_API_KEY"
  "SESSION_SECRET=$SESSION_SECRET"
  "CACHE_DISABLED=$CACHE_DISABLED"
)

# Add optional settings only when non-empty.
for name in \
  GEMINI_API_KEY GEMINI_MODEL GOOGLE_CALLBACK_URL GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET GROQ_API_KEY GROQ_MODEL GROQ_MENTOR_MODEL \
  GROQ_SCHEDULE_MODEL OPENROUTER_MODEL OPENROUTER_MENTOR_MODEL \
  ADMIN_EMAIL NEXT_PUBLIC_ADMIN_EMAIL; do
  value="${!name:-}"
  [[ -n "$value" ]] && settings+=("$name=$value")
done

log "Applying settings to $APP in $RG"
az webapp config appsettings set \
  --resource-group "$RG" \
  --name "$APP" \
  --settings "${settings[@]}" \
  --output none

# IMAGE may be supplied when a public/private image is available. The current
# repository image is not assumed because Azure must be able to pull it.
if [[ -n "${IMAGE:-}" ]]; then
  log "Configuring container image"
  registry_url="${REGISTRY_URL:-}"
  [[ -n "$registry_url" ]] || die "REGISTRY_URL is required when IMAGE is set."
  container_args=(
    --resource-group "$RG"
    --name "$APP"
    --docker-custom-image-name "$IMAGE"
    --docker-registry-server-url "$registry_url"
  )
  [[ -n "${REGISTRY_USER:-}" ]] && container_args+=(--docker-registry-server-user "$REGISTRY_USER")
  [[ -n "${REGISTRY_PASSWORD:-}" ]] && container_args+=(--docker-registry-server-password "$REGISTRY_PASSWORD")
  az webapp config container set "${container_args[@]}" --output none
fi

log "Restarting Web App"
az webapp restart --resource-group "$RG" --name "$APP" --output none

log "Configuration applied without printing secret values"
printf 'App URL: https://%s.azurewebsites.net\n' "$APP"
printf 'Health URL: https://%s.azurewebsites.net/api/health/live\n' "$APP"
printf 'Custom origin: %s\n' "$CLIENT_URL"
if [[ -z "${IMAGE:-}" ]]; then
  printf '%s\n' 'Note: IMAGE was not changed. Set IMAGE and REGISTRY_URL when a pullable container image is available.'
fi
