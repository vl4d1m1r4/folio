package db

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Open opens (or creates) the SQLite database at path, enables WAL mode and
// foreign-key enforcement, applies any pending migrations, and returns the handle.
func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("db: open %q: %w", path, err)
	}

	if _, err = db.Exec(`PRAGMA journal_mode=WAL`); err != nil {
		db.Close()
		return nil, fmt.Errorf("db: set WAL mode: %w", err)
	}

	if _, err = db.Exec(`PRAGMA foreign_keys=ON`); err != nil {
		db.Close()
		return nil, fmt.Errorf("db: enable foreign keys: %w", err)
	}

	if err = runMigrations(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("db: migrations: %w", err)
	}

	return db, nil
}

func runMigrations(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version    INTEGER PRIMARY KEY,
		applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		version, err := versionFromFilename(entry.Name())
		if err != nil {
			return err
		}

		var applied int
		if err = db.QueryRow(
			`SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, version,
		).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %d: %w", version, err)
		}
		if applied > 0 {
			continue
		}

		data, err := migrationsFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}

		if _, err = db.Exec(string(data)); err != nil {
			return fmt.Errorf("apply migration %s: %w", entry.Name(), err)
		}

		if _, err = db.Exec(
			`INSERT INTO schema_migrations (version) VALUES (?)`, version,
		); err != nil {
			return fmt.Errorf("record migration %d: %w", version, err)
		}
	}

	return nil
}

func versionFromFilename(name string) (int, error) {
	parts := strings.SplitN(name, "_", 2)
	if len(parts) == 0 {
		return 0, fmt.Errorf("unexpected migration filename: %s", name)
	}
	v, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, fmt.Errorf("cannot parse version from %q: %w", name, err)
	}
	return v, nil
}
