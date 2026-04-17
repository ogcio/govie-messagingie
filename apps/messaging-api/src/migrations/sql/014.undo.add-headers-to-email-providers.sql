ALTER table email_providers 
    DROP COLUMN headers,
    ADD COLUMN tenant TEXT NULL;