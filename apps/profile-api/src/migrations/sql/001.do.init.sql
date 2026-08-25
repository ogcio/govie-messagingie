-- DROPPING OLD TABLES - TODO: remove when all deployments on envs that already exist are done
DROP TABLE IF EXISTS migrations;

DROP TABLE IF EXISTS form_errors;

DROP TABLE IF EXISTS user_addresses;

DROP TABLE IF EXISTS user_entitlements;

DROP TABLE IF EXISTS user_details;

-- NEW TABLES
CREATE TABLE
    profiles (
        /* varchar because logto id is not a uuid but a nano id */
        id varchar(12) PRIMARY KEY NOT NULL,
        public_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        /* The common user (person) this profile belongs to */
        primary_user_id varchar(12) NOT NULL,
        safe_level INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        deleted_at TIMESTAMPTZ
    );

CREATE TABLE
    profile_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        profile_id varchar(12) NOT NULL REFERENCES profiles (id),
        organisation_id varchar(255),
        is_latest BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

CREATE TABLE
    profile_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        profile_details_id UUID NOT NULL REFERENCES profile_details (id),
        name VARCHAR(255) NOT NULL,
        value_type VARCHAR(12) NOT NULL CHECK (
            value_type IN ('string', 'number', 'boolean', 'date')
        ),
        value VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

CREATE TABLE
    profile_imports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        job_id VARCHAR(255) NOT NULL,
        organisation_id varchar(255),
        status VARCHAR(24) NOT NULL CHECK (
            status IN (
                'pending',
                'processing',
                'completed',
                'failed',
                'cancelled',
                'unrecoverable',
                'success'
            )
        ) DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

CREATE TABLE
    profile_import_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        profile_import_id UUID NOT NULL REFERENCES profile_imports (id),
        data JSONB NOT NULL,
        status VARCHAR(24) NOT NULL CHECK (
            status IN (
                'pending',
                'processing',
                'completed',
                'failed',
                'unrecoverable',
                'success'
            )
        ) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

-- Add indexes for profile lookups
CREATE INDEX idx_profiles_email ON profiles (email);

CREATE INDEX idx_profile_data_lookup ON profile_data (value, value_type, name)
WHERE
    value_type = 'string'
    AND name = 'email';

CREATE INDEX idx_profile_details_latest ON profile_details (profile_id)
WHERE
    is_latest = true;

-- Add index for job lookups
CREATE INDEX idx_profile_imports_job_id ON profile_imports (job_id);