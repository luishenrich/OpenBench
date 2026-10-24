# One image for both services: `api` (FastAPI + built frontend) and `worker` (arq).

# --- frontend build (skipped until frontend/package.json exists) -------------
FROM node:22-alpine AS web
WORKDIR /src/frontend
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
# the dashboard bundles contract/fixtures (fixture mode), imported as ../contract/fixtures
COPY contract/fixtures /src/contract/fixtures
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package.json ]; then npm ci; fi
COPY frontend/ ./
RUN if [ -f package.json ]; then npm run build; else mkdir -p dist; fi

# --- python app ---------------------------------------------------------------
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/biy ./biy
COPY contract ./contract
COPY metric-bank/src ./metric-bank/src
COPY metric-bank/data ./metric-bank/data
COPY catalog/models.json ./catalog/models.json
COPY --from=web /src/frontend/dist ./frontend/dist
ENV STATIC_DIR=/app/frontend/dist CATALOG_PATH=/app/catalog/models.json
EXPOSE 8000
CMD ["uvicorn", "biy.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
