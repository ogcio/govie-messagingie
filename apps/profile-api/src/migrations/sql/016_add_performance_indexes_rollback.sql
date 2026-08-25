-- Rollback Migration: Remove performance indexes for find-profile-with-enhanced-consent query
-- This migration removes the indexes added in 001_add_performance_indexes.sql

-- Remove the profile_details indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_profile_details_profile_org_latest;
DROP INDEX CONCURRENTLY IF EXISTS idx_profile_details_profile_null_org_latest;

-- Remove the profile_data index
DROP INDEX CONCURRENTLY IF EXISTS idx_profile_data_profile_details_id;

-- Remove the profile_consents index
DROP INDEX CONCURRENTLY IF EXISTS idx_profile_consents_profile_subject_created;

-- Remove the consent_statements index
DROP INDEX CONCURRENTLY IF EXISTS idx_consent_statements_subject_publish_version_enabled;
