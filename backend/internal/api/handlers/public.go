package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"folio/internal/config"
	"folio/internal/models"

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

// GetLanguages returns the list of configured languages, preferring DB over config.yaml.
// GET /api/v1/config/languages
func (h *PublicHandler) GetLanguages(c echo.Context) error {
	v, err := h.repo.GetSetting(c.Request().Context(), "languages")
	if err == nil && v != "" && v != "null" {
		return c.JSONBlob(http.StatusOK, []byte(v))
	}
	return c.JSON(http.StatusOK, h.cfg.Languages)
}

// GetSiteConfig returns public site metadata, preferring DB settings over config.yaml.
// GET /api/v1/config/site
func (h *PublicHandler) GetSiteConfig(c echo.Context) error {
	v, err := h.repo.GetSetting(c.Request().Context(), "site")
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load site config")
	}
	if v != "" {
		return c.JSONBlob(http.StatusOK, []byte(v))
	}
	// Fall back to config.yaml
	return c.JSON(http.StatusOK, h.cfg.Site)
}

// GetNavConfig returns nav links from DB settings, with page slugs resolved for ?lang=.
// GET /api/v1/config/nav?lang=en
func (h *PublicHandler) GetNavConfig(c echo.Context) error {
	return h.getLinksForLang(c, "nav_links")
}

// GetFooterConfig returns footer links from DB settings, with page slugs resolved for ?lang=.
// GET /api/v1/config/footer?lang=en
func (h *PublicHandler) GetFooterConfig(c echo.Context) error {
	return h.getLinksForLang(c, "footer_links")
}

// getLinksForLang returns a link-list setting with page-type URLs resolved to the requested lang's slug.
func (h *PublicHandler) getLinksForLang(c echo.Context, key string) error {
	raw, err := h.repo.GetSetting(c.Request().Context(), key)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load "+key)
	}
	if raw == "" {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	}

	lang := c.QueryParam("lang")
	if lang == "" {
		return c.JSONBlob(http.StatusOK, []byte(raw))
	}

	// Parse links and resolve page-type URLs for the requested language.
	var links []map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &links); err != nil {
		return c.JSONBlob(http.StatusOK, []byte(raw))
	}

	pages, _ := h.repo.ListPublishedPages(c.Request().Context(), lang)
	slugByID := make(map[int64]string, len(pages))
	for _, p := range pages {
		slugByID[p.ID] = p.Slug
	}

	for i, link := range links {
		// Resolve per-language label if available.
		if labelsRaw, ok := link["labels"]; ok {
			var labels map[string]string
			if json.Unmarshal(labelsRaw, &labels) == nil {
				if localLabel, ok := labels[lang]; ok && localLabel != "" {
					resolved, _ := json.Marshal(localLabel)
					links[i]["label"] = json.RawMessage(resolved)
				}
			}
		}

		var typeStr string
		if err := json.Unmarshal(link["type"], &typeStr); err != nil || typeStr != "page" {
			// Still resolve children even if the parent is not a page link.
			resolveNavChildren(links[i], lang, slugByID)
			continue
		}
		var pageID int64
		if err := json.Unmarshal(link["page_id"], &pageID); err != nil || pageID == 0 {
			resolveNavChildren(links[i], lang, slugByID)
			continue
		}
		if slug, ok := slugByID[pageID]; ok {
			resolved, _ := json.Marshal("/" + slug + "/")
			links[i]["url"] = json.RawMessage(resolved)
		}
		resolveNavChildren(links[i], lang, slugByID)
	}

	out, _ := json.Marshal(links)
	return c.JSONBlob(http.StatusOK, out)
}

// resolveNavChildren resolves per-language labels and page-type URLs inside a
// link's "children" array (dropdown items), mutating the map in place.
func resolveNavChildren(link map[string]json.RawMessage, lang string, slugByID map[int64]string) {
	childrenRaw, ok := link["children"]
	if !ok || string(childrenRaw) == "null" || string(childrenRaw) == "[]" {
		return
	}
	var children []map[string]json.RawMessage
	if err := json.Unmarshal(childrenRaw, &children); err != nil {
		return
	}
	changed := false
	for j, child := range children {
		// Resolve per-language label.
		if labelsRaw, ok := child["labels"]; ok {
			var labels map[string]string
			if json.Unmarshal(labelsRaw, &labels) == nil {
				if localLabel, ok := labels[lang]; ok && localLabel != "" {
					resolved, _ := json.Marshal(localLabel)
					children[j]["label"] = json.RawMessage(resolved)
					changed = true
				}
			}
		}
		// Resolve page-type URL.
		var typeStr string
		if child["type"] == nil {
			continue
		}
		if err := json.Unmarshal(child["type"], &typeStr); err != nil || typeStr != "page" {
			continue
		}
		if child["page_id"] == nil {
			continue
		}
		var pageID int64
		if err := json.Unmarshal(child["page_id"], &pageID); err != nil || pageID == 0 {
			continue
		}
		if slug, ok := slugByID[pageID]; ok {
			resolved, _ := json.Marshal("/" + slug + "/")
			children[j]["url"] = json.RawMessage(resolved)
			changed = true
		}
	}
	if changed {
		resolvedChildren, _ := json.Marshal(children)
		link["children"] = json.RawMessage(resolvedChildren)
	}
}

// GetUIStrings returns per-language UI strings from DB settings.
// GET /api/v1/config/ui-strings
func (h *PublicHandler) GetUIStrings(c echo.Context) error {
	return h.getSettingOrDefault(c, "ui_strings", "{}")
}

// GetSocialConfig returns social links from DB settings.
// GET /api/v1/config/social
func (h *PublicHandler) GetSocialConfig(c echo.Context) error {
	return h.getSettingOrDefault(c, "social_links", "[]")
}

// GetThemeConfig returns theme JSON from DB settings.
// GET /api/v1/config/theme
func (h *PublicHandler) GetThemeConfig(c echo.Context) error {
	return h.getSettingOrDefault(c, "theme", "null")
}

// GetHomeSections returns the home page section builder config.
// GET /api/v1/config/home?lang=en
func (h *PublicHandler) GetHomeSections(c echo.Context) error {
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = h.cfg.DefaultLanguage().Code
	}

	raw, err := h.repo.GetSetting(c.Request().Context(), "home_sections")
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load home sections")
	}
	if raw == "" {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	}

	// Parse array of blocks, resolve translation fields for the requested lang.
	var blocks []map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &blocks); err != nil {
		return c.JSONBlob(http.StatusOK, []byte(raw))
	}

	resolveBlockTranslations(blocks, lang)

	out, _ := json.Marshal(blocks)
	return c.JSONBlob(http.StatusOK, out)
}

// resolveBlockTranslations merges the requested language's translation fields into
// each block's config, removes the raw translations key, and recurses into children.
func resolveBlockTranslations(blocks []map[string]json.RawMessage, lang string) {
	for i, block := range blocks {
		if translationsRaw, ok := block["translations"]; ok {
			var translations map[string]json.RawMessage
			if err := json.Unmarshal(translationsRaw, &translations); err == nil {
				if langData, ok := translations[lang]; ok {
					var config map[string]json.RawMessage
					if cfgRaw, ok := block["config"]; ok {
						_ = json.Unmarshal(cfgRaw, &config)
					}
					if config == nil {
						config = make(map[string]json.RawMessage)
					}
					var langFields map[string]json.RawMessage
					if err := json.Unmarshal(langData, &langFields); err == nil {
						for k, v := range langFields {
							config[k] = v
						}
					}
					merged, _ := json.Marshal(config)
					blocks[i]["config"] = json.RawMessage(merged)
				}
			}
			delete(blocks[i], "translations")
		}

		// Recurse into container children so their translations are resolved too.
		if childrenRaw, ok := block["children"]; ok {
			var children []map[string]json.RawMessage
			if err := json.Unmarshal(childrenRaw, &children); err == nil {
				resolveBlockTranslations(children, lang)
				resolved, _ := json.Marshal(children)
				blocks[i]["children"] = json.RawMessage(resolved)
			}
		}
	}
}

// GetHeaderSections returns the header builder block config.
// GET /api/v1/config/header?lang=en
func (h *PublicHandler) GetHeaderSections(c echo.Context) error {
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = h.cfg.DefaultLanguage().Code
	}

	raw, err := h.repo.GetSetting(c.Request().Context(), "header_sections")
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load header sections")
	}
	if raw == "" || raw == "null" {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	}

	var blocks []map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &blocks); err != nil {
		return c.JSONBlob(http.StatusOK, []byte(raw))
	}

	resolveBlockTranslations(blocks, lang)

	out, _ := json.Marshal(blocks)
	return c.JSONBlob(http.StatusOK, out)
}

// GetFooterSections returns the footer builder block config.
// GET /api/v1/config/footer-sections?lang=en
func (h *PublicHandler) GetFooterSections(c echo.Context) error {
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = h.cfg.DefaultLanguage().Code
	}

	raw, err := h.repo.GetSetting(c.Request().Context(), "footer_sections")
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load footer sections")
	}
	if raw == "" || raw == "null" {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	}

	var blocks []map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &blocks); err != nil {
		return c.JSONBlob(http.StatusOK, []byte(raw))
	}

	resolveBlockTranslations(blocks, lang)

	out, _ := json.Marshal(blocks)
	return c.JSONBlob(http.StatusOK, out)
}

// getSettingOrDefault returns a DB setting value as raw JSON, or a default blob.
func (h *PublicHandler) getSettingOrDefault(c echo.Context, key, defaultJSON string) error {
	v, err := h.repo.GetSetting(c.Request().Context(), key)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load "+key)
	}
	if v == "" {
		return c.JSONBlob(http.StatusOK, []byte(defaultJSON))
	}
	return c.JSONBlob(http.StatusOK, []byte(v))
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
