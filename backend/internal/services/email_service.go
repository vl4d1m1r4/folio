package services

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/smtp"
	"net/url"
	"strings"
	"sync"
	"time"
)

// EmailSender is the common interface for all email transport implementations.
type EmailSender interface {
	SendEmail(ctx context.Context, to, subject, htmlBody string) error
}

// ── MS Graph ──────────────────────────────────────────────────────────────────

// MSGraphEmailService sends transactional email via Microsoft Graph (client-credentials flow).
// If all credentials are empty the service is a no-op — useful for development.
type MSGraphEmailService struct {
	tenantID     string
	clientID     string
	clientSecret string
	sender       string
	token        string
	tokenExpiry  time.Time
	mu           sync.Mutex
}

func NewMSGraphEmailService(tenantID, clientID, clientSecret, sender string) EmailSender {
	return &MSGraphEmailService{
		tenantID:     tenantID,
		clientID:     clientID,
		clientSecret: clientSecret,
		sender:       sender,
	}
}

func (s *MSGraphEmailService) getToken(ctx context.Context) (string, error) {
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
func (s *MSGraphEmailService) SendEmail(ctx context.Context, to, subject, htmlBody string) error {
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

// ── SMTP ──────────────────────────────────────────────────────────────────────

// SMTPEmailService sends email via a standard SMTP relay using STARTTLS (port 587)
// or implicit TLS (port 465). If host is empty the service is a no-op.
type SMTPEmailService struct {
	host   string
	port   string
	user   string
	pass   string
	sender string
}

// NewSMTPEmailService returns an EmailSender backed by SMTP.
// port defaults to "587" when empty.
func NewSMTPEmailService(host, port, user, pass, sender string) EmailSender {
	if port == "" {
		port = "587"
	}
	return &SMTPEmailService{host: host, port: port, user: user, pass: pass, sender: sender}
}

// SendEmail sends an HTML email via SMTP.
// Returns nil immediately if no host is configured.
func (s *SMTPEmailService) SendEmail(_ context.Context, to, subject, htmlBody string) error {
	if s.host == "" {
		log.Println("[email] SMTP not configured — skipping send")
		return nil
	}

	addr := s.host + ":" + s.port

	// Format addresses as "addr <addr>" as required by Gmail and other strict MTAs.
	fmtAddr := func(a string) string { return a + " <" + a + ">" }

	// Build RFC 2822 message.
	var msg strings.Builder
	msg.WriteString("From: " + fmtAddr(s.sender) + "\r\n")
	msg.WriteString("To: " + fmtAddr(to) + "\r\n")
	msg.WriteString("Subject: " + subject + "\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	raw := []byte(msg.String())

	if s.port == "465" {
		// Implicit TLS (SMTPS).
		tlsCfg := &tls.Config{ServerName: s.host} //nolint:gosec
		conn, err := tls.Dial("tcp", addr, tlsCfg)
		if err != nil {
			return fmt.Errorf("smtp: dial TLS: %w", err)
		}
		defer conn.Close()

		c, err := smtp.NewClient(conn, s.host)
		if err != nil {
			return fmt.Errorf("smtp: new client: %w", err)
		}
		defer c.Close()

		if s.user != "" {
			auth := smtp.PlainAuth("", s.user, s.pass, s.host)
			if err := c.Auth(auth); err != nil {
				return fmt.Errorf("smtp: auth: %w", err)
			}
		}
		if err := c.Mail(s.sender); err != nil {
			return fmt.Errorf("smtp: MAIL FROM: %w", err)
		}
		if err := c.Rcpt(to); err != nil {
			return fmt.Errorf("smtp: RCPT TO: %w", err)
		}
		w, err := c.Data()
		if err != nil {
			return fmt.Errorf("smtp: DATA: %w", err)
		}
		if _, err = w.Write(raw); err != nil {
			return fmt.Errorf("smtp: write body: %w", err)
		}
		return w.Close()
	}

	// STARTTLS (port 587) or plain (port 25).
	var auth smtp.Auth
	if s.user != "" {
		auth = smtp.PlainAuth("", s.user, s.pass, s.host)
	}
	if err := smtp.SendMail(addr, auth, s.sender, []string{to}, raw); err != nil {
		return fmt.Errorf("smtp: send: %w", err)
	}
	return nil
}
