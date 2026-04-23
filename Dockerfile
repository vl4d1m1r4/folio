# ── Stage 1: Build admin UI (Vite + React) ────────────────────────────────────
FROM node:20-alpine AS admin-builder

WORKDIR /src/admin
COPY admin/package.json ./
RUN npm install
COPY admin/ .
# theme.json is read by the Vite plugin at build time
COPY theme.json /src/theme.json
RUN npm run build

# ── Stage 2: Build Go binary ──────────────────────────────────────────────────
FROM golang:1.25-alpine AS go-builder

WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/create-admin ./cmd/create-admin/main.go

# ── Stage 3: Runtime — Node (for Eleventy rebuilds) + Go binary ───────────────
FROM node:20-alpine

# bash is required by site/build.sh and the admin rebuild handler
RUN apk --no-cache add ca-certificates tzdata bash

# Install Eleventy site dependencies so npm is not needed at container runtime
WORKDIR /app/site
COPY site/package.json ./
RUN npm install
COPY site/ .

# Go binaries
WORKDIR /app
COPY --from=go-builder /app/server ./server
COPY --from=go-builder /app/create-admin ./create-admin

# Config & theme (read by the Go binary at startup)
COPY config.yaml ./config.yaml
COPY theme.json  ./theme.json

# Pre-built admin SPA
COPY --from=admin-builder /src/admin/dist ./admin/dist

# Startup script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# /storage is the single ONCE-managed persistent volume:
#   /storage/blog.db        — SQLite database
#   /storage/uploads/       — user-uploaded media
#   /storage/site-dist/     — Eleventy-generated static site (rebuilt on demand)
RUN mkdir -p /storage/uploads /storage/site-dist

ENV DB_PATH=/storage/blog.db
ENV UPLOAD_DIR=/storage/uploads
ENV PORT=8080
ENV CONFIG_PATH=/app/config.yaml
ENV ADMIN_DIST=/app/admin/dist
ENV SITE_DIST=/storage/site-dist
ENV BACKEND_URL=http://localhost:8080
ENV SITE_BUILD_SCRIPT=/app/site/build.sh

VOLUME /storage
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
