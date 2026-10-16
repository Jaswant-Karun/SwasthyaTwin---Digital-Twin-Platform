# Production Deployment Playbook

## Container Architecture
- `backend`: FastAPI Python Uvicorn workers.
- `frontend`: Nginx serving optimized static React production build.
- `mongo`: High-performance MongoDB instance with persistent volume mounts.

## Execution
```bash
docker compose up -d --build
```
