package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"folio/internal/models"
	"folio/internal/services"

	"github.com/labstack/echo/v4"
)

// SettingsHandler handles reading and writing site settings.
type SettingsHandler struct {
	repo            *models.Repository
	emailProvider   string
	emailConfigured bool
	emailSvc        services.EmailSender
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(repo *models.Repository, emailProvider string, emailConfigured bool, emailSvc services.EmailSender) *SettingsHandler {
	return &SettingsHandler{repo: repo, emailProvider: emailProvider, emailConfigured: emailConfigured, emailSvc: emailSvc}
}

// settingsKeys is the canonical set of top-level settings keys.
var settingsKeys = []string{
	"site",
	"theme",
	"nav_links",
	"footer_links",
	"social_links",
	"home_sections",
	"header_sections",
	"footer_sections",
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

	result := make(map[string]json.RawMessage, len(settingsKeys)+1)
	for _, k := range settingsKeys {
		if v, ok := all[k]; ok && v != "" {
			result[k] = json.RawMessage(v)
		} else {
			result[k] = json.RawMessage("null")
		}
	}

	// Computed read-only field — not stored in DB.
	type emailStatus struct {
		Provider   string `json:"provider"`
		Configured bool   `json:"configured"`
	}
	esRaw, _ := json.Marshal(emailStatus{Provider: h.emailProvider, Configured: h.emailConfigured})
	result["email_status"] = json.RawMessage(esRaw)

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

// SendTestEmail — POST /api/v1/admin/settings/test-email
// Sends a test email to the supplied address using the configured provider.
func (h *SettingsHandler) SendTestEmail(c echo.Context) error {
	if !h.emailConfigured {
		return respondError(c, http.StatusUnprocessableEntity, "email is not configured — set the required environment variables and restart the server")
	}

	var body struct {
		To string `json:"to"`
	}
	if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid JSON")
	}
	body.To = strings.TrimSpace(body.To)
	if body.To == "" || !strings.Contains(body.To, "@") {
		return respondError(c, http.StatusBadRequest, "valid recipient email is required")
	}

	const subject = "Test email from your blog"
	const htmlBody = `<p>This is a test email sent from your blog's admin panel.</p>
<p>If you received this, your <strong>email delivery is working correctly</strong>.</p>`

	if err := h.emailSvc.SendEmail(c.Request().Context(), body.To, subject, htmlBody); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to send test email: "+err.Error())
	}

	return msgResponse(c, http.StatusOK, "test email sent to "+body.To)
}
