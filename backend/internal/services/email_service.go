package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// EmailService sends transactional email via Microsoft Graph (client-credentials flow).
// If all credentials are empty the service is a no-op — useful for development.
type EmailService struct {
	tenantID     string
	clientID     string
	clientSecret string
	sender       string
	token        string
	tokenExpiry  time.Time
	mu           sync.Mutex
}

func NewEmailService(tenantID, clientID, clientSecret, sender string) *EmailService {
	return &EmailService{
		tenantID:     tenantID,
		clientID:     clientID,
		clientSecret: clientSecret,
		sender:       sender,
	}
}

func (s *EmailService) getToken(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if time.Until(s.tokenExpiry) > 60*time.Second {
		return s.token, nil
	}

	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", s.tenantID)
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", s.clientID)
	form.Set("client_secret", s.clientSecret)
	form.Set("scope", "https://graph.microsoft.com/.default")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token request failed: %d %s", resp.StatusCode, string(body))
	}

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse token response: %w", err)
	}

	s.token = result.AccessToken
	s.tokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn) * time.Second)
	return s.token, nil
}

// SendEmail sends an HTML email via Microsoft Graph.
// Returns nil immediately if no credentials are configured.
func (s *EmailService) SendEmail(ctx context.Context, to, subject, htmlBody string) error {
	if s.tenantID == "" && s.clientID == "" {
		log.Println("[email] not configured — skipping send")
		return nil
	}

	token, err := s.getToken(ctx)
	if err != nil {
		return fmt.Errorf("email: acquire token: %w", err)
	}

	type addr struct{ Address string }
	type recipient struct{ EmailAddress addr }
	type body struct {
		ContentType string
		Content     string
	}
	type message struct {
		Subject      string
		Body         body
		ToRecipients []recipient
	}
	type payload struct{ Message message }

	p := payload{Message: message{
		Subject:      subject,
		Body:         body{ContentType: "HTML", Content: htmlBody},
		ToRecipients: []recipient{{EmailAddress: addr{Address: to}}},
	}}

	raw, err := json.Marshal(p)
	if err != nil {
		return err
	}

	apiURL := fmt.Sprintf("https://graph.microsoft.com/v1.0/users/%s/sendMail", s.sender)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sendMail failed: %d %s", resp.StatusCode, string(b))
	}
	return nil
}
