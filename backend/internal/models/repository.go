package models

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Repository wraps *sql.DB and provides type-safe data-access methods.
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// ── helpers ───────────────────────────────────────────────────────────────────

const sqliteDatetimeLayout = "2006-01-02 15:04:05"

func parseDateTime(s string) time.Time {
	t, err := time.Parse(sqliteDatetimeLayout, s)
	if err != nil {
		t, _ = time.Parse(time.RFC3339, s)
	}
	return t
}

func parseDateTimePtr(ns sql.NullString) *time.Time {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	t := parseDateTime(ns.String)
	return &t
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func timePtrToStr(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.UTC().Format(sqliteDatetimeLayout)
}

// ── AdminUser ─────────────────────────────────────────────────────────────────

func (r *Repository) GetAdminByUsername(ctx context.Context, username string) (*AdminUser, error) {
	u := new(AdminUser)
	var createdAt string
	err := r.db.QueryRowContext(ctx,
		`SELECT id, username, password_hash, created_at FROM admin_users WHERE username = ?`,
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &createdAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt = parseDateTime(createdAt)
	return u, nil
}

// ── Articles ──────────────────────────────────────────────────────────────────

// loadTranslations fetches all translations for a slice of article IDs and
// attaches them to the corresponding Article in the map.
func (r *Repository) loadTranslations(ctx context.Context, ids []int64) (map[int64][]ArticleTranslation, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	// Build IN clause
	in := make([]interface{}, len(ids))
	ph := make([]byte, 0, len(ids)*2)
	for i, id := range ids {
		in[i] = id
		if i > 0 {
			ph = append(ph, ',')
		}
		ph = append(ph, '?')
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT article_id, lang_code, slug, title, excerpt, body, tag, meta_title, meta_description
		 FROM article_translations WHERE article_id IN (`+string(ph)+`)
		 ORDER BY article_id, lang_code`,
		in...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int64][]ArticleTranslation)
	for rows.Next() {
		var t ArticleTranslation
		if err := rows.Scan(
			&t.ArticleID, &t.LangCode, &t.Slug, &t.Title,
			&t.Excerpt, &t.Body, &t.Tag, &t.MetaTitle, &t.MetaDescription,
		); err != nil {
			return nil, err
		}
		result[t.ArticleID] = append(result[t.ArticleID], t)
	}
	return result, rows.Err()
}

// scanArticleRow scans the shared article columns (no translations).
func scanArticleRow(row interface {
	Scan(dest ...any) error
}) (*Article, error) {
	var a Article
	var isFeatured int
	var publishedAt sql.NullString
	var createdAt, updatedAt string
	if err := row.Scan(
		&a.ID, &isFeatured, &a.CoverImagePath, &publishedAt, &createdAt, &updatedAt,
	); err != nil {
		return nil, err
	}
	a.IsFeatured = isFeatured == 1
	a.PublishedAt = parseDateTimePtr(publishedAt)
	a.CreatedAt = parseDateTime(createdAt)
	a.UpdatedAt = parseDateTime(updatedAt)
	return &a, nil
}

const articleCols = `id, is_featured, cover_image_path, published_at, created_at, updated_at`

// ListAllArticles returns all articles (including drafts) with all translations.
func (r *Repository) ListAllArticles(ctx context.Context, limit, offset int) ([]Article, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM articles`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT `+articleCols+` FROM articles ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var articles []Article
	var ids []int64
	for rows.Next() {
		a, err := scanArticleRow(rows)
		if err != nil {
			return nil, 0, err
		}
		articles = append(articles, *a)
		ids = append(ids, a.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	translationMap, err := r.loadTranslations(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	for i := range articles {
		articles[i].Translations = translationMap[articles[i].ID]
		if articles[i].Translations == nil {
			articles[i].Translations = []ArticleTranslation{}
		}
	}

	return articles, total, nil
}

// ListPublishedArticles returns published articles for a given language,
// optionally filtered by tag.
func (r *Repository) ListPublishedArticles(ctx context.Context, langCode, tag string, limit, offset int) ([]PublicArticle, int, error) {
	where := `WHERE a.published_at IS NOT NULL AND a.published_at <= datetime('now')
	          AND t.lang_code = ?`
	args := []any{langCode}

	if tag != "" {
		where += " AND t.tag = ?"
		args = append(args, tag)
	}

	var total int
	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM articles a
		 JOIN article_translations t ON t.article_id = a.id `+where,
		args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, `
		SELECT a.id, a.is_featured, a.cover_image_path, a.published_at, a.created_at, a.updated_at,
		       t.lang_code, t.slug, t.title, t.excerpt, t.body, t.tag, t.meta_title, t.meta_description
		FROM articles a
		JOIN article_translations t ON t.article_id = a.id
		`+where+`
		ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
		queryArgs...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []PublicArticle
	for rows.Next() {
		var p PublicArticle
		var isFeatured int
		var publishedAt sql.NullString
		var createdAt, updatedAt string
		if err := rows.Scan(
			&p.ID, &isFeatured, &p.CoverImagePath, &publishedAt, &createdAt, &updatedAt,
			&p.LangCode, &p.Slug, &p.Title, &p.Excerpt, &p.Body, &p.Tag, &p.MetaTitle, &p.MetaDescription,
		); err != nil {
			return nil, 0, err
		}
		p.IsFeatured = isFeatured == 1
		p.PublishedAt = parseDateTimePtr(publishedAt)
		p.CreatedAt = parseDateTime(createdAt)
		p.UpdatedAt = parseDateTime(updatedAt)
		result = append(result, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return result, total, nil
}

// GetPublishedArticleBySlug returns a single published article in the given lang.
func (r *Repository) GetPublishedArticleBySlug(ctx context.Context, slug, langCode string) (*PublicArticle, error) {
	var p PublicArticle
	var isFeatured int
	var publishedAt sql.NullString
	var createdAt, updatedAt string

	err := r.db.QueryRowContext(ctx, `
		SELECT a.id, a.is_featured, a.cover_image_path, a.published_at, a.created_at, a.updated_at,
		       t.lang_code, t.slug, t.title, t.excerpt, t.body, t.tag, t.meta_title, t.meta_description
		FROM articles a
		JOIN article_translations t ON t.article_id = a.id
		WHERE t.slug = ? AND t.lang_code = ?
		  AND a.published_at IS NOT NULL AND a.published_at <= datetime('now')`,
		slug, langCode,
	).Scan(
		&p.ID, &isFeatured, &p.CoverImagePath, &publishedAt, &createdAt, &updatedAt,
		&p.LangCode, &p.Slug, &p.Title, &p.Excerpt, &p.Body, &p.Tag, &p.MetaTitle, &p.MetaDescription,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.IsFeatured = isFeatured == 1
	p.PublishedAt = parseDateTimePtr(publishedAt)
	p.CreatedAt = parseDateTime(createdAt)
	p.UpdatedAt = parseDateTime(updatedAt)
	return &p, nil
}

// GetArticleByID loads an article with all its translations (admin use).
func (r *Repository) GetArticleByID(ctx context.Context, id int64) (*Article, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT `+articleCols+` FROM articles WHERE id = ?`, id)
	a, err := scanArticleRow(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	tm, err := r.loadTranslations(ctx, []int64{a.ID})
	if err != nil {
		return nil, err
	}
	a.Translations = tm[a.ID]
	if a.Translations == nil {
		a.Translations = []ArticleTranslation{}
	}
	return a, nil
}

// CreateArticle inserts a new article and its translations.
func (r *Repository) CreateArticle(ctx context.Context, a Article) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO articles (is_featured, cover_image_path, published_at)
		 VALUES (?, ?, ?)`,
		boolToInt(a.IsFeatured), a.CoverImagePath, timePtrToStr(a.PublishedAt),
	)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	for _, t := range a.Translations {
		if _, err := r.db.ExecContext(ctx, `
			INSERT INTO article_translations
				(article_id, lang_code, slug, title, excerpt, body, tag, meta_title, meta_description)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, t.LangCode, t.Slug, t.Title, t.Excerpt, t.Body, t.Tag, t.MetaTitle, t.MetaDescription,
		); err != nil {
			return 0, fmt.Errorf("insert translation %s: %w", t.LangCode, err)
		}
	}
	return id, nil
}

// UpdateArticle updates the shared fields and upserts all provided translations.
func (r *Repository) UpdateArticle(ctx context.Context, a Article) error {
	if _, err := r.db.ExecContext(ctx, `
		UPDATE articles
		SET is_featured=?, cover_image_path=?, published_at=?, updated_at=CURRENT_TIMESTAMP
		WHERE id=?`,
		boolToInt(a.IsFeatured), a.CoverImagePath, timePtrToStr(a.PublishedAt), a.ID,
	); err != nil {
		return err
	}

	for _, t := range a.Translations {
		if _, err := r.db.ExecContext(ctx, `
			INSERT INTO article_translations
				(article_id, lang_code, slug, title, excerpt, body, tag, meta_title, meta_description)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(article_id, lang_code) DO UPDATE SET
				slug=excluded.slug, title=excluded.title, excerpt=excluded.excerpt,
				body=excluded.body, tag=excluded.tag,
				meta_title=excluded.meta_title, meta_description=excluded.meta_description`,
			a.ID, t.LangCode, t.Slug, t.Title, t.Excerpt, t.Body, t.Tag, t.MetaTitle, t.MetaDescription,
		); err != nil {
			return fmt.Errorf("upsert translation %s: %w", t.LangCode, err)
		}
	}
	return nil
}

// SlugConflictExists returns true if any translation (excluding the given articleID) uses the slug.
func (r *Repository) SlugConflictExists(ctx context.Context, slug, langCode string, excludeArticleID int64) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM article_translations WHERE slug = ? AND lang_code = ? AND article_id != ?`,
		slug, langCode, excludeArticleID,
	).Scan(&count)
	return count > 0, err
}

// DeleteArticle deletes an article; CASCADE removes its translations.
func (r *Repository) DeleteArticle(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM articles WHERE id = ?`, id)
	return err
}

// ── ContactSubmissions ────────────────────────────────────────────────────────

func (r *Repository) CreateContactSubmission(ctx context.Context, cs ContactSubmission) (int64, error) {
	res, err := r.db.ExecContext(ctx, `
		INSERT INTO contact_submissions
			(first_name, last_name, company, email, phone, message, privacy_agreed, ip_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		cs.FirstName, cs.LastName, cs.Company, cs.Email, cs.Phone,
		cs.Message, boolToInt(cs.PrivacyAgreed), cs.IPHash,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *Repository) ListContactSubmissions(ctx context.Context, limit, offset int) ([]ContactSubmission, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM contact_submissions`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, first_name, last_name, company, email, phone, message, privacy_agreed, ip_hash, created_at
		FROM contact_submissions ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []ContactSubmission
	for rows.Next() {
		var cs ContactSubmission
		var pa int
		var ca string
		if err := rows.Scan(
			&cs.ID, &cs.FirstName, &cs.LastName, &cs.Company, &cs.Email,
			&cs.Phone, &cs.Message, &pa, &cs.IPHash, &ca,
		); err != nil {
			return nil, 0, err
		}
		cs.PrivacyAgreed = pa == 1
		cs.CreatedAt = parseDateTime(ca)
		result = append(result, cs)
	}
	return result, total, rows.Err()
}

// ── Newsletter ────────────────────────────────────────────────────────────────

func (r *Repository) CreateNewsletterSubscriber(ctx context.Context, email, ipHash string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO newsletter_subscribers (email, ip_hash) VALUES (?, ?)`,
		email, ipHash,
	)
	return err
}

func (r *Repository) ListNewsletterSubscribers(ctx context.Context, limit, offset int) ([]NewsletterSubscriber, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM newsletter_subscribers`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, email, ip_hash, subscribed_at, unsubscribed_at
		FROM newsletter_subscribers ORDER BY subscribed_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []NewsletterSubscriber
	for rows.Next() {
		var s NewsletterSubscriber
		var sa string
		var ua sql.NullString
		if err := rows.Scan(&s.ID, &s.Email, &s.IPHash, &sa, &ua); err != nil {
			return nil, 0, err
		}
		s.SubscribedAt = parseDateTime(sa)
		s.UnsubscribedAt = parseDateTimePtr(ua)
		result = append(result, s)
	}
	return result, total, rows.Err()
}

func (r *Repository) UnsubscribeByEmail(ctx context.Context, email string) (bool, error) {
	res, err := r.db.ExecContext(ctx,
		`UPDATE newsletter_subscribers SET unsubscribed_at = CURRENT_TIMESTAMP WHERE email = ?`, email)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// ── Media ─────────────────────────────────────────────────────────────────────

func (r *Repository) CreateMediaFile(ctx context.Context, m MediaFile) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO media_files (filename, original_name, mime_type, size_bytes)
		 VALUES (?, ?, ?, ?)`,
		m.Filename, m.OriginalName, m.MimeType, m.SizeBytes,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *Repository) ListMediaFiles(ctx context.Context, limit, offset int) ([]MediaFile, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM media_files`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, filename, original_name, mime_type, size_bytes, uploaded_at
		FROM media_files ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []MediaFile
	for rows.Next() {
		var mf MediaFile
		var ua string
		if err := rows.Scan(&mf.ID, &mf.Filename, &mf.OriginalName, &mf.MimeType, &mf.SizeBytes, &ua); err != nil {
			return nil, 0, err
		}
		mf.UploadedAt = parseDateTime(ua)
		result = append(result, mf)
	}
	return result, total, rows.Err()
}

func (r *Repository) GetMediaFile(ctx context.Context, id int64) (*MediaFile, error) {
	var mf MediaFile
	var ua string
	err := r.db.QueryRowContext(ctx,
		`SELECT id, filename, original_name, mime_type, size_bytes, uploaded_at FROM media_files WHERE id = ?`, id,
	).Scan(&mf.ID, &mf.Filename, &mf.OriginalName, &mf.MimeType, &mf.SizeBytes, &ua)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	mf.UploadedAt = parseDateTime(ua)
	return &mf, nil
}

func (r *Repository) DeleteMediaFile(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM media_files WHERE id = ?`, id)
	return err
}
