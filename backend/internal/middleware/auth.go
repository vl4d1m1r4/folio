package middleware

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

// JWTClaims holds the JWT payload stored in the Echo context under key "user".
type JWTClaims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// JWTMiddleware validates Bearer tokens signed with HS256.
// On success, the parsed *JWTClaims are stored under the context key "user".
func JWTMiddleware(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims := new(JWTClaims)
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			}, jwt.WithValidMethods([]string{"HS256"}))

			if err != nil || !token.Valid {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			}

			c.Set("user", claims)
			return next(c)
		}
	}
}
