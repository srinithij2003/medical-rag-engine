# Vercel Deployment (Frontend)

This repository supports Vercel deployment for the **Next.js frontend only**.

## Important architecture constraint
The clinical extraction backend depends on:
- local FastAPI runtime
- local Ollama model runtime
- offline data boundary

Because of that, the full offline stack cannot be fully hosted on Vercel.

## Recommended model
1. Deploy only `frontend/` to Vercel.
2. Keep backend (`FastAPI + Ollama`) on local/on-prem infrastructure.
3. Expose backend to the Vercel frontend only if your policy allows it.

## Vercel setup
1. Import this repo into Vercel.
2. In Project Settings -> General:
   - Root Directory: `frontend`
   - Framework Preset: Next.js
3. In Project Settings -> Environment Variables:
   - `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-host>`
4. Deploy.

## Security notes
- Do not point Vercel frontend to an unsecured backend.
- Use HTTPS and strict auth controls on backend gateway.
- If policy requires strict offline-only operation, run frontend locally instead of Vercel.
