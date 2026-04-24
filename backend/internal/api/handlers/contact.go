package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"folio/internal/models"
	"folio/internal/services"

	"github.com/labstack/echo/v4"
)

type ContactHandler struct {
	repo         *models.Repository
	emailSvc     services.EmailSender
	contactEmail string
}

func NewContactHandler(repo *models.Repository, emailSvc services.EmailSender, contactEmail string) *ContactHandler {
	return &ContactHandler{repo: repo, emailSvc: emailSvc, contactEmail: contactEmail}
}

type contactRequest struct {
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	Email          string `json:"email"`
	Company        string `json:"company"`
	Phone          string `json:"phone"`
	Message        string `json:"message"`
	PrivacyConsent string `json:"privacy_consent"`
}

// SubmitContact — POST /api/v1/contact
func (h *ContactHandler) SubmitContact(c echo.Context) error {
	var req contactRequest
	if err := c.Bind(&req); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid request body")
	}

	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Email = strings.TrimSpace(req.Email)
	req.Message = strings.TrimSpace(req.Message)

	if req.FirstName == "" {
		return respondError(c, http.StatusBadRequest, "first name is required")
	}
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return respondError(c, http.StatusBadRequest, "valid email is required")
	}
	if req.Message == "" {
		return respondError(c, http.StatusBadRequest, "message is required")
	}

	cs := models.ContactSubmission{
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Company:       req.Company,
		Email:         req.Email,
		Phone:         req.Phone,
		Message:       req.Message,
		PrivacyAgreed: true,
	}

	id, err := h.repo.CreateContactSubmission(c.Request().Context(), cs)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to save submission")
	}
	cs.ID = id

	// Resolve the contact recipient from the DB site settings (updated via admin UI),
	// falling back to the value set at startup via env / config.yaml.
	contactEmail := h.contactEmail
	if siteJSON, err := h.repo.GetSetting(c.Request().Context(), "site"); err == nil && siteJSON != "" {
		var site struct {
			ContactEmail string `json:"contactEmail"`
		}
		if json.Unmarshal([]byte(siteJSON), &site) == nil && site.ContactEmail != "" {
			contactEmail = site.ContactEmail
		}
	}

	fullName := strings.TrimSpace(req.FirstName + " " + req.LastName)
	subject := fmt.Sprintf("New contact from %s", fullName)
	htmlBody := fmt.Sprintf(`<table border="1" cellpadding="6" cellspacing="0">
<tr><th>Name</th><td>%s</td></tr>
<tr><th>Email</th><td>%s</td></tr>
<tr><th>Company</th><td>%s</td></tr>
<tr><th>Phone</th><td>%s</td></tr>
<tr><th>Message</th><td>%s</td></tr>
</table>`, fullName, req.Email, req.Company, req.Phone, req.Message)

	if err := h.emailSvc.SendEmail(c.Request().Context(), contactEmail, subject, htmlBody); err != nil {
		log.Printf("[contact] email notification failed: %v", err)
	}

	return c.JSON(http.StatusCreated, cs)
}
