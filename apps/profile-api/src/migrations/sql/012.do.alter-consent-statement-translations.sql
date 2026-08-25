ALTER TABLE consent_statement_translations
DROP COLUMN body_top,
DROP COLUMN body_list,
DROP COLUMN body_bottom,
DROP COLUMN body_small,
DROP COLUMN body_links,
DROP COLUMN body_footer,
ADD COLUMN description text NULL,
ADD COLUMN disclaimer text NULL;