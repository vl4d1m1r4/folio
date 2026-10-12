package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func newRateLimitedServer(perMinute int) *echo.Echo {
	e := echo.New()
	e.IPExtractor = echo.ExtractIPFromXFFHeader()
	e.POST("/limited", func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	}, RateLimit(perMinute))
	return e
}

func post(e *echo.Echo, remoteAddr, xff string) int {
	req := httptest.NewRequest(http.MethodPost, "/limited", nil)
	req.RemoteAddr = remoteAddr
	if xff != "" {
		req.Header.Set(echo.HeaderXForwardedFor, xff)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec.Code
}

func TestRateLimitBlocksAfterLimit(t *testing.T) {
	e := newRateLimitedServer(3)
	for i := 0; i < 3; i++ {
		if code := post(e, "203.0.113.1:1234", ""); code != http.StatusOK {
			t.Fatalf("request %d: got %d, want 200", i+1, code)
		}
	}
	if code := post(e, "203.0.113.1:1234", ""); code != http.StatusTooManyRequests {
		t.Fatalf("request 4: got %d, want 429", code)
	}
	// A different client is not affected.
	if code := post(e, "203.0.113.2:1234", ""); code != http.StatusOK {
		t.Fatalf("other client: got %d, want 200", code)
	}
}

func TestRateLimitUsesForwardedIPBehindProxy(t *testing.T) {
	e := newRateLimitedServer(1)
	// Both requests arrive from the reverse proxy (private IP) on behalf of
	// different visitors, so each visitor gets its own limit.
	if code := post(e, "172.18.0.5:1234", "198.51.100.1"); code != http.StatusOK {
		t.Fatalf("visitor 1: got %d, want 200", code)
	}
	if code := post(e, "172.18.0.5:1234", "198.51.100.2"); code != http.StatusOK {
		t.Fatalf("visitor 2: got %d, want 200", code)
	}
	if code := post(e, "172.18.0.5:1234", "198.51.100.1"); code != http.StatusTooManyRequests {
		t.Fatalf("visitor 1 again: got %d, want 429", code)
	}
}

func TestRateLimitIgnoresSpoofedHeaderFromPublicClient(t *testing.T) {
	e := newRateLimitedServer(1)
	// A client connecting directly can't dodge the limit by faking X-Forwarded-For.
	if code := post(e, "203.0.113.9:1234", "198.51.100.1"); code != http.StatusOK {
		t.Fatalf("first: got %d, want 200", code)
	}
	if code := post(e, "203.0.113.9:1234", "198.51.100.77"); code != http.StatusTooManyRequests {
		t.Fatalf("spoofed: got %d, want 429", code)
	}
}
