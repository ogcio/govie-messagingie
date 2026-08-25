ALTER TABLE profiles
ADD COLUMN preferred_language VARCHAR(2) NOT NULL DEFAULT 'en'
CHECK (preferred_language IN ('en', 'ga')); 