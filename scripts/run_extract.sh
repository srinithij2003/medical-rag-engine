#!/usr/bin/env bash
set -euo pipefail

# Simple helper to login and run an extraction against the local backend
# Usage: ./scripts/run_extract.sh ["Patient text..."]

BASE_URL=${BASE_URL:-http://127.0.0.1:8000}
TEXT=${1:-"Patient is a 45-year-old male with chest pain and shortness of breath."}

echo "Logging in to $BASE_URL"
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r .access_token)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to obtain token" >&2
  exit 1
fi

echo "Token obtained, calling /extract"
curl -s -X POST "$BASE_URL/extract" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg t "$TEXT" '{text:$t}')" | jq
