package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"folio/internal/models"

	"github.com/labstack/echo/v4"
)

// PagesHandler handles admin CRUD and public read for custom pages.
type PagesHandler struct {
	repo *models.Repository
}

// NewPagesHandler creates a new PagesHandler.
func NewPagesHandler(repo *models.Repository) *PagesHandler {
	return &PagesHandler{repo: repo}
}

// ── Admin ─────────────────────────────────────────────────────────────────────

// ListPages — GET /api/v1/admin/pages
func (h *PagesHandler) ListPages(c echo.Context) error {
	limit, offset, page := paginationParams(c)
	items, total, err := h.repo.ListAllPages(c.Request().Context(), limit, offset)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load pages")
	}
	if items == nil {
		items = []models.Page{}
	}
	return c.JSON(http.StatusOK, models.PaginatedPages{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}

// GetPage — GET /api/v1/admin/pages/:id
func (h *PagesHandler) GetPage(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid page id")
	}
	p, err := h.repo.GetPageByID(c.Request().Context(), id)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load page")
	}
	if p == nil {
		return respondError(c, http.StatusNotFound, "page not found")
	}
	return c.JSON(http.StatusOK, p)
}

// CreatePage — POST /api/v1/admin/pages
func (h *PagesHandler) CreatePage(c echo.Context) error {
	var p models.Page
	if err := c.Bind(&p); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid JSON")
	}
	if len(p.Translations) == 0 {
		return respondError(c, http.StatusUnprocessableEntity, "at least one translation is required")
	}
	for _, t := range p.Translations {
		if t.Slug == "" || t.Title == "" {
			return respondError(c, http.StatusUnprocessableEntity,
				fmt.Sprintf("translation %q requires slug and title", t.LangCode))
		}
		conflict, err := h.repo.PageSlugConflictExists(c.Request().Context(), t.Slug, t.LangCode, 0)
		if err != nil {
			return respondError(c, http.StatusInternalServerError, "failed to check slug")
		}
		if conflict {
			return respondError(c, http.StatusConflict,
				fmt.Sprintf("slug %q already used in language %q", t.Slug, t.LangCode))
		}
	}

	id, err := h.repo.CreatePage(c.Request().Context(), p)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to create page")
	}
	p.ID = id

	if p.IsPublished {
		select {
		case <-triggerSiteRebuild():
		case <-time.After(30 * time.Second):
		}
	}
	return c.JSON(http.StatusCreated, p)
}

// UpdatePage — PUT /api/v1/admin/pages/:id
func (h *PagesHandler) UpdatePage(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid page id")
	}
	existing, err := h.repo.GetPageByID(c.Request().Context(), id)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load page")
	}
	if existing == nil {
		return respondError(c, http.StatusNotFound, "page not found")
	}

	var p models.Page
	if err := c.Bind(&p); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid JSON")
	}
	p.ID = id

	for _, t := range p.Translations {
		if t.Slug == "" || t.Title == "" {
			return respondError(c, http.StatusUnprocessableEntity,
				fmt.Sprintf("translation %q requires slug and title", t.LangCode))
		}
		conflict, err := h.repo.PageSlugConflictExists(c.Request().Context(), t.Slug, t.LangCode, id)
		if err != nil {
			return respondError(c, http.StatusInternalServerError, "failed to check slug")
		}
		if conflict {
			return respondError(c, http.StatusConflict,
				fmt.Sprintf("slug %q already used in language %q", t.Slug, t.LangCode))
		}
	}

	if err := h.repo.UpdatePage(c.Request().Context(), p); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to update page")
	}

	updated, _ := h.repo.GetPageByID(c.Request().Context(), id)
	if updated == nil {
		updated = &p
	}

	select {
	case <-triggerSiteRebuild():
	case <-time.After(30 * time.Second):
	}

	return c.JSON(http.StatusOK, updated)
}

// DeletePage — DELETE /api/v1/admin/pages/:id
func (h *PagesHandler) DeletePage(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		return respondError(c, http.StatusBadRequest, "invalid page id")
	}
	if err := h.repo.DeletePage(c.Request().Context(), id); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to delete page")
	}
	// Rebuild so the deleted page is no longer in the static output.
	select {
	case <-triggerSiteRebuild():
	case <-time.After(30 * time.Second):
	}
	return c.NoContent(http.StatusNoContent)
}

// ── Public ────────────────────────────────────────────────────────────────────

// ListPublicPages — GET /api/v1/pages?lang=en
func (h *PagesHandler) ListPublicPages(c echo.Context) error {
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = "en"
	}
	pages, err := h.repo.ListPublishedPages(c.Request().Context(), lang)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load pages")
	}
	if pages == nil {
		pages = []models.PublicPage{}
	}
	return c.JSON(http.StatusOK, pages)
}

// GetPublicPage — GET /api/v1/pages/:slug?lang=en
func (h *PagesHandler) GetPublicPage(c echo.Context) error {
	slug := c.Param("slug")
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = "en"
	}
	p, err := h.repo.GetPublishedPageBySlug(c.Request().Context(), slug, lang)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load page")
	}
	if p == nil {
		return respondError(c, http.StatusNotFound, "not found")
	}
	return c.JSON(http.StatusOK, p)
}
