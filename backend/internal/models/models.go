package models

import "time"

// AdminUser is an authenticated admin account.
type AdminUser struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

// ArticleTranslation holds the language-specific content of a single article.
type ArticleTranslation struct {
	ArticleID       int64  `json:"article_id"`
	LangCode        string `json:"lang_code"`
	Slug            string `json:"slug"`
	Title           string `json:"title"`
	Excerpt         string `json:"excerpt"`
	Body            string `json:"body"`
	Tag             string `json:"tag"`
	MetaTitle       string `json:"meta_title"`
	MetaDescription string `json:"meta_description"`
}

// Article is the language-independent article record, plus its translations.
// In admin API responses all translations are included.
// In public API responses the matching translation's fields are merged flat (see PublicArticle).
type Article struct {
	ID             int64                `json:"id"`
	IsFeatured     bool                 `json:"is_featured"`
	CoverImagePath string               `json:"cover_image_path"`
	PublishedAt    *time.Time           `json:"published_at"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
	Translations   []ArticleTranslation `json:"translations"`
}

// PublicArticle is the flattened, single-language representation returned by
// public (unauthenticated) article endpoints. It merges the shared article
// fields with one translation's fields.
type PublicArticle struct {
	ID             int64      `json:"id"`
	IsFeatured     bool       `json:"is_featured"`
	CoverImagePath string     `json:"cover_image_path"`
	PublishedAt    *time.Time `json:"published_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	// Translation fields
	LangCode        string `json:"lang_code"`
	Slug            string `json:"slug"`
	Title           string `json:"title"`
	Excerpt         string `json:"excerpt"`
	Body            string `json:"body"`
	Tag             string `json:"tag"`
	MetaTitle       string `json:"meta_title"`
	MetaDescription string `json:"meta_description"`
}

// ContactSubmission is a single contact form entry.
type ContactSubmission struct {
	ID            int64     `json:"id"`
	FirstName     string    `json:"first_name"`
	LastName      string    `json:"last_name"`
	Company       string    `json:"company"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	Message       string    `json:"message"`
	PrivacyAgreed bool      `json:"privacy_agreed"`
	IPHash        string    `json:"ip_hash"`
	CreatedAt     time.Time `json:"created_at"`
}

// NewsletterSubscriber is an email that has subscribed to the newsletter.
type NewsletterSubscriber struct {
	ID             int64      `json:"id"`
	Email          string     `json:"email"`
	IPHash         string     `json:"ip_hash"`
	SubscribedAt   time.Time  `json:"subscribed_at"`
	UnsubscribedAt *time.Time `json:"unsubscribed_at"`
}

// MediaFile is an uploaded file record.
type MediaFile struct {
	ID           int64     `json:"id"`
	Filename     string    `json:"filename"`
	OriginalName string    `json:"original_name"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	UploadedAt   time.Time `json:"uploaded_at"`
}

// PaginatedResult is a generic pagination wrapper.
type PaginatedResult[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Limit int `json:"limit"`
}

// Concrete paginated types (needed for JSON serialisation).
type PaginatedPublicArticles struct {
	Items []PublicArticle `json:"items"`
	Total int             `json:"total"`
	Page  int             `json:"page"`
	Limit int             `json:"limit"`
}

type PaginatedArticles struct {
	Items []Article `json:"items"`
	Total int       `json:"total"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
}

type PaginatedMediaFiles struct {
	Items []MediaFile `json:"items"`
	Total int         `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

type PaginatedContacts struct {
	Items []ContactSubmission `json:"items"`
	Total int                 `json:"total"`
	Page  int                 `json:"page"`
	Limit int                 `json:"limit"`
}

type PaginatedSubscribers struct {
	Items []NewsletterSubscriber `json:"items"`
	Total int                    `json:"total"`
	Page  int                    `json:"page"`
	Limit int                    `json:"limit"`
}
