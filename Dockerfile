# ── Build stage ────────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /src

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server/main.go

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/server ./server
COPY config.yaml ./config.yaml
COPY theme.json  ./theme.json

# Directories persisted via volumes
RUN mkdir -p /data /uploads

ENV DB_PATH=/data/blog.db
ENV UPLOAD_DIR=/uploads
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["./server"]
