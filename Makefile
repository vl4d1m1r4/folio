.PHONY: setup dev build docker-up docker-down clean

# ── Setup: install deps, run migrations, create admin user ─────────────────────
setup:
	@echo "→ Installing admin UI dependencies…"
	cd admin && npm install
	@echo "→ Installing site dependencies…"
	cd site && npm install
	@echo "→ Downloading Go dependencies…"
	cd backend && go mod tidy
	@echo "→ Running database migrations…"
	@mkdir -p data
	@DB_PATH=./data/blog.db cd backend && go run ./cmd/server/main.go --migrate-only 2>/dev/null || true
	@echo "→ Creating admin user…"
	cd backend && go run ./cmd/create-admin/main.go

# ── Dev: start backend + site (Eleventy) in watch mode ─────────────────────────
dev:
	@echo "→ Starting backend on :8080 and site on :8081…"
	cd backend && go run ./cmd/server/main.go & \
	cd site && npm run dev

# ── Build: compile Go binary + build site ──────────────────────────────────────
build:
	@echo "→ Building Go binary…"
	cd backend && go build -o ../dist/openblog-server ./cmd/server/main.go
	@echo "→ Building admin UI…"
	cd admin && npm run build
	@echo "→ Building site…"
	cd site && npm run build
	@echo "✓ Build artifacts in dist/"

# ── Docker ─────────────────────────────────────────────────────────────────────
docker-up:
	docker compose up --build -d
	@echo "✓ Running at http://localhost"

docker-down:
	docker compose down

# ── Cleanup ────────────────────────────────────────────────────────────────────
clean:
	rm -rf dist/ admin/dist/ site/dist/
