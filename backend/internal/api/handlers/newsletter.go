package handlers

import (
	"net/http"
	"strings"

	"openblog/internal/models"

	"github.com/labstack/echo/v4"
)

type NewsletterHandler struct {
	repo *models.Repository
}

func NewNewsletterHandler(repo *models.Repository) *NewsletterHandler {
	return &NewsletterHandler{repo: repo}
}

type subscribeRequest struct {
	Email string `json:"email"`
}

type unsubscribeRequest struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

// Subscribe — POST /api/v1/newsletter/subscribe
func (h *NewsletterHandler) Subscribe(c echo.Context) error {
	var req subscribeRequest
	if err := c.Bind(&req); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid request body")
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return respondError(c, http.StatusBadRequest, "valid email is required")
	}
	if err := h.repo.CreateNewsletterSubscriber(c.Request().Context(), req.Email, ""); err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to subscribe")
	}
	return msgResponse(c, http.StatusOK, "subscribed")
}

// Unsubscribe — POST /api/v1/newsletter/unsubscribe
func (h *NewsletterHandler) Unsubscribe(c echo.Context) error {
	var req unsubscribeRequest
	if err := c.Bind(&req); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid request body")
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		return respondError(c, http.StatusBadRequest, "email is required")
	}
	// Token field kept for forward-compatibility but not validated yet.
	found, err := h.repo.UnsubscribeByEmail(c.Request().Context(), req.Email)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to unsubscribe")
	}
	if !found {
		return respondError(c, http.StatusNotFound, "subscriber not found")
	}
	return msgResponse(c, http.StatusOK, "unsubscribed")
}
