# Production Deployment Guide

## Local/on-prem deployment targets
- Air-gapped clinic network
- Single-node hospital edge server
- Enterprise private subnet

## Recommended hardening
1. Replace default `JWT_SECRET` and rotate regularly.
2. Restrict access to ports `3000`, `8000`, `11434` by subnet ACL.
3. Terminate TLS at local reverse proxy (Nginx/Traefik/Envoy).
4. Encrypt data volume for `./data` (LUKS/FileVault/VeraCrypt).
5. Enable centralized local log shipping (ELK/OpenSearch/Vector).
6. Pin Ollama model versions and run acceptance tests before upgrades.

## Air-gapped setup notes
1. Preload Docker images and model blobs on removable media.
2. Import images with `docker load`.
3. Start platform via `docker compose up -d`.
4. Verify no egress route for runtime hosts.

## Observability checklist
- Collect API latency (`X-Request-Time-Ms`)
- Track extraction validation failure rate
- Track per-model response times
- Store audit logs with immutable retention policy
