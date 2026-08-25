ALTER TABLE profiles
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted'));