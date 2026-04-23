package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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

// seedSettings seeds DB settings from config.yaml + theme.json on first boot.
func seedSettings(repo *models.Repository, cfg *config.Config, themePath string) {
	ctx := context.Background()
	all, err := repo.GetAllSettings(ctx)
	if err != nil {
		log.Printf("seedSettings: failed to read settings: %v", err)
		return
	}

	// Seed "site" from config.yaml if not yet stored.
	if _, ok := all["site"]; !ok {
		type sitePayload struct {
			Name         string      `json:"name"`
			Tagline      string      `json:"tagline"`
			URL          string      `json:"url"`
			BookingURL   string      `json:"bookingUrl"`
			ContactEmail string      `json:"contactEmail"`
			Tags         []string    `json:"tags"`
			Social       interface{} `json:"social"`
		}
		sp := sitePayload{
			Name:         cfg.Site.Name,
			Tagline:      cfg.Site.Tagline,
			URL:          cfg.Site.URL,
			BookingURL:   cfg.Site.BookingURL,
			ContactEmail: cfg.ContactEmail,
			Tags:         cfg.Tags,
			Social:       cfg.Site.Social,
		}
		b, _ := json.Marshal(sp)
		if err := repo.SetSetting(ctx, "site", string(b)); err != nil {
			log.Printf("seedSettings: failed to seed site: %v", err)
		}
	}

	// Seed "theme" from theme.json if not yet stored.
	if _, ok := all["theme"]; !ok {
		data, err := os.ReadFile(themePath)
		if err == nil {
			if err := repo.SetSetting(ctx, "theme", string(data)); err != nil {
				log.Printf("seedSettings: failed to seed theme: %v", err)
			}
		}
	}

	// Seed default nav_links / footer_links / social_links if absent.
	if _, ok := all["nav_links"]; !ok {
		defaultNav := `[{"type":"builtin","label":"Home","url":"/","order":0},{"type":"builtin","label":"Articles","url":"/articles/","order":1},{"type":"builtin","label":"Contact","url":"/contact/","order":2}]`
		_ = repo.SetSetting(ctx, "nav_links", defaultNav)
	}
	if _, ok := all["footer_links"]; !ok {
		defaultFooter := `[{"type":"builtin","label":"Home","url":"/","order":0},{"type":"builtin","label":"Articles","url":"/articles/","order":1},{"type":"builtin","label":"Contact","url":"/contact/","order":2}]`
		_ = repo.SetSetting(ctx, "footer_links", defaultFooter)
	}
	if _, ok := all["social_links"]; !ok {
		type socialLink struct {
			Platform string `json:"platform"`
			URL      string `json:"url"`
		}
		var links []socialLink
		if cfg.Site.Social.Twitter != "" {
			links = append(links, socialLink{"twitter", cfg.Site.Social.Twitter})
		}
		if cfg.Site.Social.LinkedIn != "" {
			links = append(links, socialLink{"linkedin", cfg.Site.Social.LinkedIn})
		}
		if cfg.Site.Social.GitHub != "" {
			links = append(links, socialLink{"github", cfg.Site.Social.GitHub})
		}
		b, _ := json.Marshal(links)
		_ = repo.SetSetting(ctx, "social_links", string(b))
	}

	// Seed default home_sections matching the existing layout.
	if _, ok := all["home_sections"]; !ok {
		defaultSections := `[
			{"id":"hero","type":"hero","visible":true,"order":0,"config":{},"translations":{"en":{"headline":"","subheadline":"","cta_label":"Book a free call","cta_url":""}}},
			{"id":"featured","type":"featured-articles","visible":true,"order":1,"config":{"max_count":4},"translations":{"en":{"title":"Featured"}}},
			{"id":"latest","type":"latest-articles","visible":true,"order":2,"config":{"max_count":6},"translations":{"en":{"title":"Latest Articles"}}},
			{"id":"cta","type":"cta-band","visible":true,"order":3,"config":{},"translations":{"en":{"headline":"Ready to get started?","body":"","cta_label":"Book a call","cta_url":""}}}
		]`
		_ = repo.SetSetting(ctx, "home_sections", defaultSections)
	}

	// Seed languages from config.yaml if not yet stored in DB.
	if _, ok := all["languages"]; !ok {
		b, _ := json.Marshal(cfg.Languages)
		_ = repo.SetSetting(ctx, "languages", string(b))
	}

	// Seed default UI strings (English) if not yet stored.
	if _, ok := all["ui_strings"]; !ok {
		defaultUI := `{"en":{"contact_title":"Contact","contact_intro":"Fill in the form below and we'll get back to you.","contact_first_name":"First name","contact_last_name":"Last name","contact_company":"Company","contact_email":"Email","contact_phone":"Phone","contact_message":"Message","contact_submit":"Send message","contact_success":"Thank you for your message — we'll be in touch soon!","contact_error":"Something went wrong. Please try again.","unsubscribe_title":"Unsubscribe","unsubscribe_intro":"Enter your email address below to unsubscribe from the newsletter.","unsubscribe_email_placeholder":"Your email address","unsubscribe_submit":"Unsubscribe","unsubscribe_success":"You have been unsubscribed successfully.","articles_title":"Articles","articles_intro":"Articles, guides and news.","articles_all_filter":"All","articles_no_results":"No articles found for this tag.","articles_no_articles":"No articles published yet. Check back soon.","article_home":"Home","article_read_more":"Read more","reading_time_suffix":"min read"}}`
		_ = repo.SetSetting(ctx, "ui_strings", defaultUI)
	}
}

func main() {
	// 1. Load .env (ignored if absent)
	_ = godotenv.Load()

	// 2. Load config.yaml
	// CONFIG_PATH env var wins; otherwise auto-detect (Docker: ./config.yaml, dev: ../config.yaml).
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		if _, statErr := os.Stat("config.yaml"); statErr == nil {
			configPath = "config.yaml"
		} else {
			configPath = filepath.Join("..", "config.yaml")
		}
	}
	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("failed to load config.yaml: %v", err)
	}

	// Resolve theme.json path alongside config.yaml.
	themeDir := filepath.Dir(configPath)
	themePath := filepath.Join(themeDir, "theme.json")

	// 3. Read env vars
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	dbPath := getEnv("DB_PATH", "./blog.db")
	port := getEnv("PORT", "8080")
	uploadDir := getEnv("UPLOAD_DIR", "./uploads")
	adminDistDir := getEnv("ADMIN_DIST", "./admin/dist")
	siteDistDir := getEnv("SITE_DIST", "./site/dist")
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

	// Seed DB from config.yaml + theme.json on first boot.
	seedSettings(repo, cfg, themePath)

	emailSvc := services.NewEmailService(tenantID, clientID, clientSecret, sender)
	authH := handlers.NewAuthHandler(repo, jwtSecret)
	publicH := handlers.NewPublicHandler(repo, cfg)
	adminH := handlers.NewAdminHandler(repo, cfg, uploadDir)
	contactH := handlers.NewContactHandler(repo, emailSvc, contactEmail)
	newsletterH := handlers.NewNewsletterHandler(repo)
	settingsH := handlers.NewSettingsHandler(repo)
	pagesH := handlers.NewPagesHandler(repo)

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

	// 8. Health check — required by ONCE for zero-downtime deploys
	e.GET("/up", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	// Static uploads
	e.Static("/uploads", uploadDir)

	// Admin UI — React SPA served from /admin/* with index.html fallback
	adminHandler := func(c echo.Context) error {
		subPath := filepath.Clean("/" + c.Param("*"))
		target := filepath.Join(adminDistDir, subPath)
		// Prevent path traversal outside adminDistDir
		rel, relErr := filepath.Rel(adminDistDir, target)
		if relErr != nil || strings.HasPrefix(rel, "..") {
			return echo.ErrForbidden
		}
		if info, statErr := os.Stat(target); statErr == nil && !info.IsDir() {
			return c.File(target)
		}
		return c.File(filepath.Join(adminDistDir, "index.html"))
	}
	e.GET("/admin", adminHandler)
	e.GET("/admin/*", adminHandler)

	// 9. Routes
	api := e.Group("/api/v1")

	// Auth
	api.POST("/auth/login", authH.Login)
	api.POST("/auth/refresh", authH.Refresh, jwtMiddleware.JWTMiddleware(jwtSecret))

	// Public config
	api.GET("/config/languages", publicH.GetLanguages)
	api.GET("/config/site", publicH.GetSiteConfig)
	api.GET("/config/nav", publicH.GetNavConfig)
	api.GET("/config/footer", publicH.GetFooterConfig)
	api.GET("/config/social", publicH.GetSocialConfig)
	api.GET("/config/theme", publicH.GetThemeConfig)
	api.GET("/config/home", publicH.GetHomeSections)
	api.GET("/config/ui-strings", publicH.GetUIStrings)

	// Public articles
	api.GET("/articles", publicH.ListArticles)
	api.GET("/articles/:slug", publicH.GetArticle)

	// Public pages
	api.GET("/pages", pagesH.ListPublicPages)
	api.GET("/pages/:slug", pagesH.GetPublicPage)

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

	admin.GET("/settings", settingsH.GetSettings)
	admin.PUT("/settings", settingsH.PutSettings)

	admin.GET("/pages", pagesH.ListPages)
	admin.POST("/pages", pagesH.CreatePage)
	admin.GET("/pages/:id", pagesH.GetPage)
	admin.PUT("/pages/:id", pagesH.UpdatePage)
	admin.DELETE("/pages/:id", pagesH.DeletePage)

	// Public site — Eleventy static output, catch-all (must be registered last)
	e.Static("/", siteDistDir)

	// 10. Start
	e.Logger.Fatal(e.Start(":" + port))
}
