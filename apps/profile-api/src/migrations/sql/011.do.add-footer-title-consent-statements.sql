ALTER TABLE consent_statement_translations
ADD COLUMN title text NOT NULL,
ADD COLUMN body_footer text NOT NULL;