ALTER table email_providers 
    ADD COLUMN headers jsonb NULL,
    DROP COLUMN tenant;