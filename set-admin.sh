  # Set ADMIN_EMAIL on the StudyBuddy Azure backend and redeploy (restart).
  set -Eeuo pipefail
  
  # --- Required: set this to your login email before running ---
  ADMIN_EMAIL='satyamsinghpx@gmail.com'
  
  # --- Azure target (repo defaults; override if your names differ) ---
  RG="${RG:-studybuddy-rg}"
  APP="${APP:-studybuddy-api-20260914}"
  
  command -v az >/dev/null || {
    echo "Azure CLI is required. Install it, then run 'az login'." >&2
    exit 1
  }
  
  az account show >/dev/null 2>&1 || {
    echo "Not logged in. Run: az login" >&2
    exit 1
  }
  
  az webapp show \
    --resource-group "$RG" \
    --name "$APP" \
    --output none || {
    echo "Web app '$APP' not found in resource group '$RG'. Set APP=/RG= to the correct names." >&2
    exit 1
  }
  
  echo "==> Setting ADMIN_EMAIL / NEXT_PUBLIC_ADMIN_EMAIL on $APP"
  az webapp config appsettings set \
    --resource-group "$RG" \
    --name "$APP" \
    --settings \
      ADMIN_EMAIL="$ADMIN_EMAIL" \
      NEXT_PUBLIC_ADMIN_EMAIL="$ADMIN_EMAIL" \
    --output none
  
  echo "==> Restarting $APP to apply the new environment variables"
  az webapp restart \
    --resource-group "$RG" \
    --name "$APP" \
    --output none
  
  API_URL="https://${APP}.azurewebsites.net"
  
  echo "==> Waiting for liveness: $API_URL/api/health/live"
  for attempt in $(seq 1 30); do
    if curl --fail --silent --show-error --max-time 15 "$API_URL/api/health/live" >/dev/null; then
      echo "Backend is live."
      break
    fi
    [ "$attempt" -eq 30 ] && { echo "Backend never became live. Check: az webapp log tail -g $RG -n $APP" >&2; exit 1; }
    echo "Attempt ${attempt}/30 failed; retrying in 10s..."
    sleep 10
  done
  
  echo "==> Checking MongoDB-backed readiness: $API_URL/api/health/ready"
  if curl --fail --silent --show-error --max-time 20 "$API_URL/api/health/ready"; then
    echo
    echo "Done: ADMIN_EMAIL set to '$ADMIN_EMAIL' and backend is ready."
  else
    echo
    echo "Backend is live but not ready — check MongoDB Atlas network access and logs:" >&2
    echo "az webapp log tail --resource-group \"$RG\" --name \"$APP\"" >&2
    exit 1
  fi
