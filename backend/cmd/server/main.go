package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"openblog/internal/api/handlers"
	"openblog/internal/config"
	"openblog/internal/db"
	jwtMiddleware "openblog/internal/middleware"
	"openblog/internal/models"
	"openblog/internal/services"
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	// 1. Load .env (ignored if absent)
	_ = godotenv.Load()

	// 2. Load config.yaml
	// Look for config.yaml one directory above the binary (repo root).
	cfg, err := config.Load(filepath.Join("..", "config.yaml"))
	if err != nil {
		log.Fatalf("failed to load config.yaml: %v", err)
	}

	// 3. Read env vars
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	dbPath := getEnv("DB_PATH", "./blog.db")
	port := getEnv("PORT", "8080")
	uploadDir := getEnv("UPLOAD_DIR", "./uploads")
	contactEmail := getEnv("CONTACT_EMAIL", cfg.ContactEmail)

	tenantID := os.Getenv("MS_GRAPH_TENANT_ID")
	clientID := os.Getenv("MS_GRAPH_CLIENT_ID")
	clientSecret := os.Getenv("MS_GRAPH_CLIENT_SECRET")
	sender := os.Getenv("MS_GRAPH_SENDER")

	// 4. Ensure upload directory exists
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		log.Fatalf("failed to create upload dir: %v", err)
	}

	// 5. Open database
	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	// 6. Instantiate services and handlers
	repo := models.NewRepository(database)
	emailSvc := services.NewEmailService(tenantID, clientID, clientSecret, sender)
	authH := handlers.NewAuthHandler(repo, jwtSecret)
	publicH := handlers.NewPublicHandler(repo, cfg)
	adminH := handlers.NewAdminHandler(repo, cfg, uploadDir)
	contactH := handlers.NewContactHandler(repo, emailSvc, contactEmail)
	newsletterH := handlers.NewNewsletterHandler(repo)

	// 7. Echo setup
	e := echo.New()
	e.HideBanner = true
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
	}))

	// 8. Static uploads (proxied by nginx/caddy in production)
	e.Static("/uploads", uploadDir)

	// 9. Routes
	api := e.Group("/api/v1")

	// Auth
	api.POST("/auth/login", authH.Login)
	api.POST("/auth/refresh", authH.Refresh, jwtMiddleware.JWTMiddleware(jwtSecret))

	// Public config
	api.GET("/config/languages", publicH.GetLanguages)
	api.GET("/config/site", publicH.GetSiteConfig)

	// Public articles
	api.GET("/articles", publicH.ListArticles)
	api.GET("/articles/:slug", publicH.GetArticle)

	// Public forms
	api.POST("/contact", contactH.SubmitContact)
	api.POST("/newsletter/subscribe", newsletterH.Subscribe)
	api.POST("/newsletter/unsubscribe", newsletterH.Unsubscribe)

	// Admin (JWT protected)
	admin := api.Group("/admin", jwtMiddleware.JWTMiddleware(jwtSecret))

	admin.GET("/articles", adminH.ListArticles)
	admin.POST("/articles", adminH.CreateArticle)
	admin.GET("/articles/:id", adminH.GetArticleByID)
	admin.PUT("/articles/:id", adminH.UpdateArticle)
	admin.DELETE("/articles/:id", adminH.DeleteArticle)
	admin.GET("/tags", adminH.GetTags)
	admin.POST("/rebuild", adminH.TriggerRebuild)

	admin.GET("/media", adminH.ListMedia)
	admin.POST("/media", adminH.UploadMedia)
	admin.DELETE("/media/:id", adminH.DeleteMedia)

	admin.GET("/contacts", adminH.ListContacts)
	admin.GET("/newsletter", adminH.ListNewsletter)

	// 10. Start
	e.Logger.Fatal(e.Start(":" + port))
}
