package handlers

import (
	"encoding/json"
	"net/http"

	"folio/internal/models"

	"github.com/labstack/echo/v4"
)

// SettingsHandler handles reading and writing site settings.
type SettingsHandler struct {
	repo *models.Repository
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(repo *models.Repository) *SettingsHandler {
	return &SettingsHandler{repo: repo}
}

// settingsKeys is the canonical set of top-level settings keys.
var settingsKeys = []string{
	"site",
	"theme",
	"nav_links",
	"footer_links",
	"social_links",
	"home_sections",
	"languages",
	"ui_strings",
}

// GetSettings — GET /api/v1/admin/settings
// Returns a JSON object whose keys are settings keys and values are already-parsed JSON.
func (h *SettingsHandler) GetSettings(c echo.Context) error {
	all, err := h.repo.GetAllSettings(c.Request().Context())
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load settings")
	}

	result := make(map[string]json.RawMessage, len(settingsKeys))
	for _, k := range settingsKeys {
		if v, ok := all[k]; ok && v != "" {
			result[k] = json.RawMessage(v)
		} else {
			result[k] = json.RawMessage("null")
		}
	}
	return c.JSON(http.StatusOK, result)
}

// PutSettings — PUT /api/v1/admin/settings
// Accepts a JSON object of key→value pairs.  Only recognised keys are stored.
func (h *SettingsHandler) PutSettings(c echo.Context) error {
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(c.Request().Body).Decode(&raw); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid JSON")
	}

	allowed := make(map[string]struct{}, len(settingsKeys))
	for _, k := range settingsKeys {
		allowed[k] = struct{}{}
	}

	ctx := c.Request().Context()
	for k, v := range raw {
		if _, ok := allowed[k]; !ok {
			continue
		}
		if err := h.repo.SetSetting(ctx, k, string(v)); err != nil {
			return respondError(c, http.StatusInternalServerError, "failed to save setting: "+k)
		}
	}

	return msgResponse(c, http.StatusOK, "settings saved")
}
