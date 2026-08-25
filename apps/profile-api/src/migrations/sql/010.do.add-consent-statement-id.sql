ALTER TABLE profile_consents
ADD column consent_statement_id UUID NOT NULL REFERENCES consent_statements (id);