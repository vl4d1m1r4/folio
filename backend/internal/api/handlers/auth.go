package handlers

import (
	"net/http"
	"time"

	"folio/internal/middleware"
	"folio/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	repo      *models.Repository
	jwtSecret string
	tokenTTL  time.Duration
}

func NewAuthHandler(repo *models.Repository, jwtSecret string) *AuthHandler {
	return &AuthHandler{repo: repo, jwtSecret: jwtSecret, tokenTTL: 24 * time.Hour}
}

func (h *AuthHandler) generateToken(username string) (string, time.Time, error) {
	expiresAt := time.Now().UTC().Add(h.tokenTTL)
	claims := middleware.JWTClaims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.jwtSecret))
	return signed, expiresAt, err
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Login — POST /api/v1/auth/login
func (h *AuthHandler) Login(c echo.Context) error {
	var req loginRequest
	if err := c.Bind(&req); err != nil {
		return respondError(c, http.StatusBadRequest, "invalid request")
	}

	user, err := h.repo.GetAdminByUsername(c.Request().Context(), req.Username)

	// Always run bcrypt to prevent timing-based username enumeration.
	var hashToCompare []byte
	if err != nil || user == nil {
		hashToCompare = []byte("$2a$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
	} else {
		hashToCompare = []byte(user.PasswordHash)
	}
	compareErr := bcrypt.CompareHashAndPassword(hashToCompare, []byte(req.Password))

	if err != nil || user == nil || compareErr != nil {
		return respondError(c, http.StatusUnauthorized, "invalid credentials")
	}

	signed, expiresAt, err := h.generateToken(user.Username)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "could not generate token")
	}
	return c.JSON(http.StatusOK, loginResponse{Token: signed, ExpiresAt: expiresAt})
}

// Refresh — POST /api/v1/auth/refresh
func (h *AuthHandler) Refresh(c echo.Context) error {
	claims, ok := c.Get("user").(*middleware.JWTClaims)
	if !ok || claims == nil {
		return respondError(c, http.StatusUnauthorized, "unauthorized")
	}
	signed, expiresAt, err := h.generateToken(claims.Username)
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "could not generate token")
	}
	return c.JSON(http.StatusOK, loginResponse{Token: signed, ExpiresAt: expiresAt})
}
