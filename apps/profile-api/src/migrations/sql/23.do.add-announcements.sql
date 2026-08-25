CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    application_id TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    publish_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    created_by TEXT NULL
);

CREATE TABLE announcement_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    announcement_id UUID NOT NULL REFERENCES announcements (id) ON DELETE CASCADE,
    language VARCHAR(2) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

ALTER TABLE announcement_translations
    ADD CONSTRAINT unique_announcement_translation_language UNIQUE (announcement_id, language);

CREATE TABLE announcement_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    announcement_id UUID NOT NULL REFERENCES announcements (id) ON DELETE CASCADE,
    profile_id VARCHAR(18) NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

ALTER TABLE announcement_acknowledgements
    ADD CONSTRAINT unique_announcement_acknowledgement_profile UNIQUE (announcement_id, profile_id);

CREATE INDEX idx_announcements_application_publish_date
    ON announcements (application_id, publish_date DESC);

CREATE INDEX idx_announcements_application_publish_date_enabled
    ON announcements (application_id, publish_date DESC)
    WHERE is_enabled = true;