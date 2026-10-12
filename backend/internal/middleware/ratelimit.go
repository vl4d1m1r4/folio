package middleware

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"
)

// RateLimit allows each client IP up to perMinute requests per minute, with
// bursts of up to perMinute requests. Extra requests get HTTP 429.
// Each call creates its own store, so routes sharing one returned middleware
// also share the limit.
func RateLimit(perMinute int) echo.MiddlewareFunc {
	store := echoMiddleware.NewRateLimiterMemoryStoreWithConfig(echoMiddleware.RateLimiterMemoryStoreConfig{
		Rate:      rate.Limit(float64(perMinute) / 60),
		Burst:     perMinute,
		ExpiresIn: 10 * time.Minute,
	})
	return echoMiddleware.RateLimiterWithConfig(echoMiddleware.RateLimiterConfig{
		Store: store,
		IdentifierExtractor: func(c echo.Context) (string, error) {
			return c.RealIP(), nil
		},
		DenyHandler: func(c echo.Context, _ string, _ error) error {
			c.Response().Header().Set("Retry-After", "60")
			return c.JSON(http.StatusTooManyRequests, map[string]string{
				"error": "too many requests, please try again in a minute",
			})
		},
	})
}
