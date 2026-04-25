package models

import (
	"context"
	"database/sql"
	"encoding/json"
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

// sectionsJSON returns the raw JSON for sections, defaulting to '[]' if nil/empty.
func sectionsJSON(raw json.RawMessage) string {
	if len(raw) == 0 {
		return "[]"
	}
	return string(raw)
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

// ── Site Settings ─────────────────────────────────────────────────────────────

// GetSetting fetches a single setting value by key. Returns "" if not found.
func (r *Repository) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := r.db.QueryRowContext(ctx,
		`SELECT value FROM site_settings WHERE key = ?`, key,
	).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

// SetSetting upserts a single setting row.
func (r *Repository) SetSetting(ctx context.Context, key, value string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO site_settings (key, value, updated_at)
		 VALUES (?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
		key, value,
	)
	return err
}

// GetAllSettings returns every settings row as a map[key]value.
func (r *Repository) GetAllSettings(ctx context.Context) (map[string]string, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT key, value FROM site_settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		result[k] = v
	}
	return result, rows.Err()
}

// ── Pages ─────────────────────────────────────────────────────────────────────

const pageCols = `id, is_published, created_at, updated_at`

func scanPageRow(row interface{ Scan(dest ...any) error }) (*Page, error) {
	var p Page
	var isPublished int
	var createdAt, updatedAt string
	if err := row.Scan(&p.ID, &isPublished, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	p.IsPublished = isPublished == 1
	p.CreatedAt = parseDateTime(createdAt)
	p.UpdatedAt = parseDateTime(updatedAt)
	return &p, nil
}

func (r *Repository) loadPageTranslations(ctx context.Context, ids []int64) (map[int64][]PageTranslation, error) {
	if len(ids) == 0 {
		return nil, nil
	}
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
		`SELECT page_id, lang_code, slug, title, body, sections, meta_title, meta_description
		 FROM page_translations WHERE page_id IN (`+string(ph)+`)
		 ORDER BY page_id, lang_code`,
		in...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[int64][]PageTranslation)
	for rows.Next() {
		var t PageTranslation
		var sectionsStr string
		if err := rows.Scan(&t.PageID, &t.LangCode, &t.Slug, &t.Title, &t.Body, &sectionsStr, &t.MetaTitle, &t.MetaDescription); err != nil {
			return nil, err
		}
		if sectionsStr == "" {
			sectionsStr = "[]"
		}
		t.Sections = json.RawMessage(sectionsStr)
		result[t.PageID] = append(result[t.PageID], t)
	}
	return result, rows.Err()
}

// ListAllPages returns all pages with translations (admin use).
func (r *Repository) ListAllPages(ctx context.Context, limit, offset int) ([]Page, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pages`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+pageCols+` FROM pages ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var pages []Page
	var ids []int64
	for rows.Next() {
		p, err := scanPageRow(rows)
		if err != nil {
			return nil, 0, err
		}
		pages = append(pages, *p)
		ids = append(ids, p.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	tm, err := r.loadPageTranslations(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	for i := range pages {
		pages[i].Translations = tm[pages[i].ID]
		if pages[i].Translations == nil {
			pages[i].Translations = []PageTranslation{}
		}
	}
	return pages, total, nil
}

// ListPublishedPages returns published pages for a given language.
func (r *Repository) ListPublishedPages(ctx context.Context, langCode string) ([]PublicPage, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT p.id, p.is_published, p.created_at, p.updated_at,
		       t.lang_code, t.slug, t.title, t.body, t.sections, t.meta_title, t.meta_description
		FROM pages p
		JOIN page_translations t ON t.page_id = p.id
		WHERE p.is_published = 1 AND t.lang_code = ?
		ORDER BY p.created_at DESC`,
		langCode,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []PublicPage
	for rows.Next() {
		var pp PublicPage
		var isPublished int
		var ca, ua string
		var sectionsStr string
		if err := rows.Scan(
			&pp.ID, &isPublished, &ca, &ua,
			&pp.LangCode, &pp.Slug, &pp.Title, &pp.Body, &sectionsStr, &pp.MetaTitle, &pp.MetaDescription,
		); err != nil {
			return nil, err
		}
		if sectionsStr == "" {
			sectionsStr = "[]"
		}
		pp.Sections = json.RawMessage(sectionsStr)
		pp.IsPublished = isPublished == 1
		pp.CreatedAt = parseDateTime(ca)
		pp.UpdatedAt = parseDateTime(ua)
		result = append(result, pp)
	}
	return result, rows.Err()
}

// GetPublishedPageBySlug returns a single published page for the given slug + lang.
func (r *Repository) GetPublishedPageBySlug(ctx context.Context, slug, langCode string) (*PublicPage, error) {
	var pp PublicPage
	var isPublished int
	var ca, ua string
	var sectionsStr string
	err := r.db.QueryRowContext(ctx, `
		SELECT p.id, p.is_published, p.created_at, p.updated_at,
		       t.lang_code, t.slug, t.title, t.body, t.sections, t.meta_title, t.meta_description
		FROM pages p
		JOIN page_translations t ON t.page_id = p.id
		WHERE t.slug = ? AND t.lang_code = ? AND p.is_published = 1`,
		slug, langCode,
	).Scan(&pp.ID, &isPublished, &ca, &ua,
		&pp.LangCode, &pp.Slug, &pp.Title, &pp.Body, &sectionsStr, &pp.MetaTitle, &pp.MetaDescription)
	if sectionsStr == "" {
		sectionsStr = "[]"
	}
	pp.Sections = json.RawMessage(sectionsStr)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	pp.IsPublished = isPublished == 1
	pp.CreatedAt = parseDateTime(ca)
	pp.UpdatedAt = parseDateTime(ua)
	return &pp, nil
}

// GetPageByID returns a page with all translations (admin use).
func (r *Repository) GetPageByID(ctx context.Context, id int64) (*Page, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+pageCols+` FROM pages WHERE id = ?`, id)
	p, err := scanPageRow(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	tm, err := r.loadPageTranslations(ctx, []int64{p.ID})
	if err != nil {
		return nil, err
	}
	p.Translations = tm[p.ID]
	if p.Translations == nil {
		p.Translations = []PageTranslation{}
	}
	return p, nil
}

// CreatePage inserts a new page and its translations.
func (r *Repository) CreatePage(ctx context.Context, p Page) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO pages (is_published) VALUES (?)`, boolToInt(p.IsPublished))
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	for _, t := range p.Translations {
		// Skip non-default translations that have no slug — nothing to persist.
		if t.Slug == "" {
			continue
		}
		if _, err := r.db.ExecContext(ctx, `
			INSERT INTO page_translations (page_id, lang_code, slug, title, body, sections, meta_title, meta_description)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, t.LangCode, t.Slug, t.Title, t.Body, sectionsJSON(t.Sections), t.MetaTitle, t.MetaDescription,
		); err != nil {
			return 0, fmt.Errorf("insert page translation %s: %w", t.LangCode, err)
		}
	}
	return id, nil
}

// UpdatePage updates shared fields and upserts translations.
func (r *Repository) UpdatePage(ctx context.Context, p Page) error {
	if _, err := r.db.ExecContext(ctx,
		`UPDATE pages SET is_published=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
		boolToInt(p.IsPublished), p.ID,
	); err != nil {
		return err
	}
	for _, t := range p.Translations {
		// Skip non-default translations that have no slug — nothing to persist.
		if t.Slug == "" {
			continue
		}
		if _, err := r.db.ExecContext(ctx, `
			INSERT INTO page_translations (page_id, lang_code, slug, title, body, sections, meta_title, meta_description)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(page_id, lang_code) DO UPDATE SET
				slug=excluded.slug, title=excluded.title, body=excluded.body,
				sections=excluded.sections,
				meta_title=excluded.meta_title, meta_description=excluded.meta_description`,
			p.ID, t.LangCode, t.Slug, t.Title, t.Body, sectionsJSON(t.Sections), t.MetaTitle, t.MetaDescription,
		); err != nil {
			return fmt.Errorf("upsert page translation %s: %w", t.LangCode, err)
		}
	}
	return nil
}

// DeletePage deletes a page; CASCADE removes its translations.
func (r *Repository) DeletePage(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM pages WHERE id = ?`, id)
	return err
}

// PageSlugConflictExists returns true if a different page already uses the slug.
func (r *Repository) PageSlugConflictExists(ctx context.Context, slug, langCode string, excludePageID int64) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM page_translations WHERE slug = ? AND lang_code = ? AND page_id != ?`,
		slug, langCode, excludePageID,
	).Scan(&count)
	return count > 0, err
}
