ALTER TABLE profile_imports
ADD COLUMN source VARCHAR(10) NOT NULL CHECK (
    source IN ('json', 'csv')
) DEFAULT 'csv'; 