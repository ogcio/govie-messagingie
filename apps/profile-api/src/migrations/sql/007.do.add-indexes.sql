CREATE INDEX IF NOT EXISTS idx_profile_details_profile_id_latest ON profile_details(profile_id, is_latest);
CREATE INDEX IF NOT EXISTS idx_profile_data_details_id ON profile_data(profile_details_id);
CREATE INDEX IF NOT EXISTS idx_profile_data_name_value ON profile_data(name, value);
CREATE INDEX IF NOT EXISTS idx_profile_data_value_type ON profile_data(value_type);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_public_name ON profiles(public_name);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
