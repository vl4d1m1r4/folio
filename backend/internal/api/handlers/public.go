package handlers

import (
	"net/http"
	"strconv"

	"openblog/internal/config"
	"openblog/internal/models"

	"github.com/labstack/echo/v4"
)

// PublicHandler handles unauthenticated public content endpoints.
type PublicHandler struct {
	repo *models.Repository
	cfg  *config.Config
}

// NewPublicHandler creates a new PublicHandler.
func NewPublicHandler(repo *models.Repository, cfg *config.Config) *PublicHandler {
	return &PublicHandler{repo: repo, cfg: cfg}
}

// GetLanguages returns the list of configured languages.
// GET /api/v1/config/languages
func (h *PublicHandler) GetLanguages(c echo.Context) error {
	return c.JSON(http.StatusOK, h.cfg.Languages)
}

// GetSiteConfig returns public site metadata (name, tagline, social links, etc.).
// GET /api/v1/config/site
func (h *PublicHandler) GetSiteConfig(c echo.Context) error {
	return c.JSON(http.StatusOK, h.cfg.Site)
}

// ListArticles returns published articles for the requested language.
// GET /api/v1/articles?lang=en&tag=News&page=1&limit=10
func (h *PublicHandler) ListArticles(c echo.Context) error {
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = h.cfg.DefaultLanguage().Code
	}
	tag := c.QueryParam("tag")

	page := 1
	if p := c.QueryParam("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	limit := 10
	if l := c.QueryParam("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			if v > 200 {
				v = 200
			}
			limit = v
		}
	}

	articles, total, err := h.repo.ListPublishedArticles(
		c.Request().Context(), lang, tag, limit, (page-1)*limit,
	)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load articles")
	}
	if articles == nil {
		articles = []models.PublicArticle{}
	}

	return c.JSON(http.StatusOK, models.PaginatedPublicArticles{
		Items: articles,
		Total: total,
		Page:  page,
		Limit: limit,
	})
}

// GetArticle returns a single published article by slug.
// GET /api/v1/articles/:slug?lang=en
func (h *PublicHandler) GetArticle(c echo.Context) error {
	slug := c.Param("slug")
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = h.cfg.DefaultLanguage().Code
	}

	article, err := h.repo.GetPublishedArticleBySlug(c.Request().Context(), slug, lang)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load article")
	}
	if article == nil {
		return respondError(c, http.StatusNotFound, "not found")
	}
	return c.JSON(http.StatusOK, article)
}
