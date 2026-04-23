-- Migration 003: add sections (block builder JSON) to page_translations

ALTER TABLE page_translations ADD COLUMN sections TEXT NOT NULL DEFAULT '[]';
