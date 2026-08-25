ALTER TABLE consent_statement_translations
    ADD COLUMN body_top text[] DEFAULT [],
    ADD COLUMN body_list text[] DEFAULT [],
    ADD COLUMN body_bottom text[] DEFAULT [],
    ADD COLUMN body_small text[] DEFAULT [],
    ADD COLUMN body_links jsonb DEFAULT [],
    ADD COLUMN body_footer text DEFAULT [],
    DROP COLUMN description,
    DROP COLUMN disclaimer;