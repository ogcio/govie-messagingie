-- Migration: Add performance indexes for find-profile-with-enhanced-consent query
-- This migration adds composite indexes to improve query performance on large tables

-- Index for profile_details to support filtering by profile_id, organisation_id, and is_latest
-- This optimizes the subquery that aggregates profile data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_details_profile_org_latest 
ON profile_details (profile_id, organisation_id, is_latest);

-- Partial index for profile_details when organisation_id is NULL (common case)
-- This provides efficient lookup for profiles without organization context
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_details_profile_null_org_latest 
ON profile_details (profile_id) 
WHERE organisation_id IS NULL AND is_latest = true;

-- Index for profile_data to support the JOIN with profile_details
-- This optimizes the aggregation of profile data values
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_data_profile_details_id 
ON profile_data (profile_details_id);

-- Composite index for profile_consents to support filtering by profile_id and subject
-- with efficient ordering by created_at for latest consent lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_consents_profile_subject_created 
ON profile_consents (profile_id, subject, created_at DESC);

-- Partial composite index for consent_statements to support latest enabled statement lookup
-- This optimizes the CTE that finds the most recent enabled consent statement per subject
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consent_statements_subject_publish_version_enabled 
ON consent_statements (subject, publish_date DESC, version DESC) 
WHERE is_enabled = true;

-- Add comments for documentation
COMMENT ON INDEX idx_profile_details_profile_org_latest IS 'Optimizes profile details lookup by profile_id, organisation_id, and is_latest flag';
COMMENT ON INDEX idx_profile_details_profile_null_org_latest IS 'Optimizes profile details lookup when organisation_id is NULL and is_latest is true';
COMMENT ON INDEX idx_profile_data_profile_details_id IS 'Optimizes profile data aggregation by profile_details_id';
COMMENT ON INDEX idx_profile_consents_profile_subject_created IS 'Optimizes latest consent lookup by profile_id, subject, and created_at ordering';
COMMENT ON INDEX idx_consent_statements_subject_publish_version_enabled IS 'Optimizes latest enabled consent statement lookup by subject, publish_date, and version';
