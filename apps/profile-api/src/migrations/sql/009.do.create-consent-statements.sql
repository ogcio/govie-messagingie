CREATE TABLE
    consent_statements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        subject varchar(50) NOT NULL,
        version INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

ALTER TABLE consent_statements
    ADD CONSTRAINT unique_subject_version UNIQUE (subject, version);

CREATE TABLE consent_statement_translations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        consent_statement_id UUID NOT NULL REFERENCES consent_statements (id),
        language varchar(2) NOT NULL,
        body_top text[] NOT NULL,
        body_list text[] NOT NULL,
        body_bottom text[] NOT NULL,
        body_small text[] NOT NULL,
        body_links jsonb NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );