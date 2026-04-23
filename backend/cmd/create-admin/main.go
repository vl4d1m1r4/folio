package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

func main() {
	dbPath := flag.String("db", "./blog.db", "Path to SQLite database")
	username := flag.String("user", "admin", "Admin username")
	password := flag.String("pass", "", "Admin password (leave empty to auto-generate)")
	flag.Parse()

	pwd := *password
	if pwd == "" {
		b := make([]byte, 16)
		rand.Read(b)
		pwd = hex.EncodeToString(b)
		fmt.Fprintf(os.Stderr, "Generated password: %s\n", pwd)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(pwd), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}

	db, err := sql.Open("sqlite", *dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	_, err = db.Exec(
		`INSERT INTO admin_users (username, password_hash) VALUES (?, ?)
		 ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash`,
		*username, string(hash),
	)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Admin user %q created/updated.\n", *username)
}
