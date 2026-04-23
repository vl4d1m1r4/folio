package handlers

import "github.com/labstack/echo/v4"

// ErrorResponse is the standard error envelope returned by all handlers.
type ErrorResponse struct {
	Error string `json:"error"`
}

func respondError(c echo.Context, code int, msg string) error {
	return c.JSON(code, ErrorResponse{Error: msg})
}

func msgResponse(c echo.Context, code int, msg string) error {
	return c.JSON(code, map[string]string{"message": msg})
}
