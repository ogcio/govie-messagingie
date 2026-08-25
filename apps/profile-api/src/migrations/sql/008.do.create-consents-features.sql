CREATE TABLE
    profile_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        profile_id varchar(12) NOT NULL REFERENCES profiles (id),
        subject varchar(50),
        status varchar(30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

CREATE INDEX idx_profile_consents_profile_created ON profile_consents (profile_id, created_at DESC);

ALTER TABLE profiles
ADD COLUMN consent_statuses JSONB DEFAULT NULL NULL;

CREATE INDEX idx_profiles_consent_statuses_gin ON profiles USING GIN (consent_statuses);