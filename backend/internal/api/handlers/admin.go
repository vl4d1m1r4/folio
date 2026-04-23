package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"folio/internal/config"
	"folio/internal/models"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// AdminHandler handles all admin CRUD operations.
type AdminHandler struct {
	repo      *models.Repository
	cfg       *config.Config
	uploadDir string
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler(repo *models.Repository, cfg *config.Config, uploadDir string) *AdminHandler {
	return &AdminHandler{repo: repo, cfg: cfg, uploadDir: uploadDir}
}

// triggerSiteRebuild runs site/build.sh asynchronously and returns a channel
// that carries any error when the script finishes.
func triggerSiteRebuild() <-chan error {
	script := os.Getenv("SITE_BUILD_SCRIPT")
	if script == "" {
		script = filepath.Join("..", "site", "build.sh")
	}
	ch := make(chan error, 1)
	go func() {
		cmd := exec.Command("bash", script)
		cmd.Env = os.Environ()
		out, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("[site rebuild] ERROR: %v\n%s", err, out)
			ch <- fmt.Errorf("%w: %s", err, out)
		} else {
			log.Printf("[site rebuild] OK: %s", out)
			ch <- nil
		}
	}()
	return ch
}

func paginationParams(c echo.Context) (limit, offset, page int) {
	page, _ = strconv.Atoi(c.QueryParam("page"))
	limit, _ = strconv.Atoi(c.QueryParam("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset = (page - 1) * limit
	return
}

// ── Articles ──────────────────────────────────────────────────────────────────

// ListArticles — GET /admin/articles
func (h *AdminHandler) ListArticles(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListAllArticles(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load articles")
	}
	if items == nil {
		items = []models.Article{}
	}
	return c.JSON(http.StatusOK, models.PaginatedArticles{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}

// GetArticleByID — GET /admin/articles/:id
func (h *AdminHandler) GetArticleByID(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid article id")
	}
	a, err := h.repo.GetArticleByID(c.Request().Context(), id)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load article")
	}
	if a == nil {
		return respondError(c, http.StatusNotFound, "article not found")
	}
	return c.JSON(http.StatusOK, a)
}

// CreateArticle — POST /admin/articles
func (h *AdminHandler) CreateArticle(c echo.Context) error {
	var a models.Article
	if err := c.Bind(&a); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid JSON")
	}
	if len(a.Translations) == 0 {
		return respondError(c, http.StatusUnprocessableEntity, "at least one translation is required")
	}

	// Validate each translation and check slug uniqueness.
	for _, t := range a.Translations {
		if t.Slug == "" || t.Title == "" {
			return respondError(c, http.StatusUnprocessableEntity,
				fmt.Sprintf("translation %q requires slug and title", t.LangCode))
		}
		conflict, err := h.repo.SlugConflictExists(c.Request().Context(), t.Slug, t.LangCode, 0)
		if err != nil {
			return respondError(c, http.StatusInternalServerError, "failed to check slug uniqueness")
		}
		if conflict {
			return respondError(c, http.StatusConflict,
				fmt.Sprintf("slug %q already used in language %q", t.Slug, t.LangCode))
		}
	}

	id, err := h.repo.CreateArticle(c.Request().Context(), a)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to create article")
	}
	a.ID = id

	var rebuildWarning string
	if a.PublishedAt != nil {
		select {
		case rebuildErr := <-triggerSiteRebuild():
			if rebuildErr != nil {
				rebuildWarning = "Site regeneration failed — check server logs."
			}
		case <-time.After(30 * time.Second):
			// Still running; don't block the response.
		}
	}

	type resp struct {
		models.Article
		RebuildWarning string `json:"rebuild_warning,omitempty"`
	}
	return c.JSON(http.StatusCreated, resp{Article: a, RebuildWarning: rebuildWarning})
}

// UpdateArticle — PUT /admin/articles/:id
func (h *AdminHandler) UpdateArticle(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid article id")
	}

	existing, err := h.repo.GetArticleByID(c.Request().Context(), id)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load article")
	}
	if existing == nil {
		return respondError(c, http.StatusNotFound, "article not found")
	}

	var a models.Article
	if err := c.Bind(&a); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid JSON")
	}
	a.ID = id

	// Validate slug uniqueness for each provided translation.
	for _, t := range a.Translations {
		if t.Slug == "" || t.Title == "" {
			return respondError(c, http.StatusUnprocessableEntity,
				fmt.Sprintf("translation %q requires slug and title", t.LangCode))
		}
		conflict, err := h.repo.SlugConflictExists(c.Request().Context(), t.Slug, t.LangCode, id)
		if err != nil {
			return respondError(c, http.StatusInternalServerError, "failed to check slug uniqueness")
		}
		if conflict {
			return respondError(c, http.StatusConflict,
				fmt.Sprintf("slug %q already used in language %q", t.Slug, t.LangCode))
		}
	}

	wasPublished := existing.PublishedAt != nil
	if err := h.repo.UpdateArticle(c.Request().Context(), a); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to update article")
	}

	updated, _ := h.repo.GetArticleByID(c.Request().Context(), id)

	var rebuildWarning string
	publishChanged := (a.PublishedAt != nil) != wasPublished
	if publishChanged || (a.PublishedAt != nil) {
		select {
		case rebuildErr := <-triggerSiteRebuild():
			if rebuildErr != nil {
				rebuildWarning = "Site regeneration failed — check server logs."
			}
		case <-time.After(30 * time.Second):
		}
	}

	type resp struct {
		*models.Article
		RebuildWarning string `json:"rebuild_warning,omitempty"`
	}
	return c.JSON(http.StatusOK, resp{Article: updated, RebuildWarning: rebuildWarning})
}

// DeleteArticle — DELETE /admin/articles/:id
func (h *AdminHandler) DeleteArticle(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid article id")
	}
	if err := h.repo.DeleteArticle(c.Request().Context(), id); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to delete article")
	}
	return c.NoContent(http.StatusNoContent)
}

// GetTags returns the configured tag list.
// GET /admin/tags
func (h *AdminHandler) GetTags(c echo.Context) error {
	// Prefer tags stored in the "site" setting (set via Settings page).
	all, err := h.repo.GetAllSettings(c.Request().Context())
	if err == nil {
		if raw, ok := all["site"]; ok && raw != "" {
			var site struct {
				Tags []string `json:"tags"`
			}
			if json.Unmarshal([]byte(raw), &site) == nil && len(site.Tags) > 0 {
				return c.JSON(http.StatusOK, site.Tags)
			}
		}
	}
	// Fall back to config.yaml
	return c.JSON(http.StatusOK, h.cfg.Tags)
}

// TriggerRebuild manually triggers a site rebuild.
// POST /admin/rebuild
func (h *AdminHandler) TriggerRebuild(c echo.Context) error {
	select {
	case err := <-triggerSiteRebuild():
		if err != nil {
			return respondError(c, http.StatusInternalServerError, err.Error())
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	case <-time.After(60 * time.Second):
		return c.JSON(http.StatusAccepted, map[string]string{"status": "building"})
	}
}

// ── Media ─────────────────────────────────────────────────────────────────────

// ListMedia — GET /admin/media
func (h *AdminHandler) ListMedia(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListMediaFiles(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to list media")
	}
	if items == nil {
		items = []models.MediaFile{}
	}
	return c.JSON(http.StatusOK, models.PaginatedMediaFiles{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}

// UploadMedia — POST /admin/media
func (h *AdminHandler) UploadMedia(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return respondError(c, http.StatusBadRequest, "file is required")
	}

	const maxSize = 20 << 20 // 20 MB
	if file.Size > maxSize {
		return respondError(c, http.StatusRequestEntityTooLarge, "file exceeds 20 MB limit")
	}

	src, err := file.Open()
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to open upload")
	}
	defer src.Close()

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s%s", uuid.NewString(), ext)
	dst, err := os.Create(filepath.Join(h.uploadDir, filename))
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to save file")
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to write file")
	}

	ct := file.Header.Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}

	mf := models.MediaFile{
		Filename:     filename,
		OriginalName: file.Filename,
		MimeType:     ct,
		SizeBytes:    file.Size,
	}
	id, err := h.repo.CreateMediaFile(c.Request().Context(), mf)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to record media")
	}
	mf.ID = id
	return c.JSON(http.StatusCreated, mf)
}

// DeleteMedia — DELETE /admin/media/:id
func (h *AdminHandler) DeleteMedia(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid media id")
	}
	mf, err := h.repo.GetMediaFile(c.Request().Context(), id)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to find media")
	}
	if mf == nil {
		return respondError(c, http.StatusNotFound, "not found")
	}
	_ = os.Remove(filepath.Join(h.uploadDir, filepath.Base(mf.Filename)))
	if err := h.repo.DeleteMediaFile(c.Request().Context(), id); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to delete media")
	}
	return c.NoContent(http.StatusNoContent)
}

// ── Contacts ──────────────────────────────────────────────────────────────────

// ListContacts — GET /admin/contacts
func (h *AdminHandler) ListContacts(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListContactSubmissions(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to list contacts")
	}
	if items == nil {
		items = []models.ContactSubmission{}
	}
	return c.JSON(http.StatusOK, models.PaginatedContacts{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}

// ── Newsletter ────────────────────────────────────────────────────────────────

// ListNewsletter — GET /admin/newsletter
func (h *AdminHandler) ListNewsletter(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListNewsletterSubscribers(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to list subscribers")
	}
	if items == nil {
		items = []models.NewsletterSubscriber{}
	}
	return c.JSON(http.StatusOK, models.PaginatedSubscribers{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}
