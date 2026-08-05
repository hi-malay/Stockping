# One image, two jobs:
#   Cloud Run service (UI)  -> npm start
#   Cloud Run job (checker)  -> npx tsx scripts/run-once.ts   (see CMD override at deploy)
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CONTAINER=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DATA_DIR=/data \
    PROFILE_DIR=/tmp/profiles

WORKDIR /app

# deps first so the layer caches across source changes
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# headless shell only — we never need headed chromium in the container
RUN npx playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["npm", "start", "--", "--port", "8080", "--hostname", "0.0.0.0"]
