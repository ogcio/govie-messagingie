CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS batch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_fingerprint text NOT NULL,
  status text NOT NULL,
  organization_id text NOT NULL,
  message_subject text NOT NULL,
  send_at_mode text NOT NULL,
  send_at_value timestamptz NULL,
  csv_content_hash text NOT NULL,
  html_content_hash text NOT NULL,
  txt_content_hash text NOT NULL,
  template_variables_schema_version text NOT NULL,
  operational_settings_snapshot jsonb NOT NULL,
  latest_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS batch_runs_run_fingerprint_idx
  ON batch_runs (run_fingerprint);

CREATE INDEX IF NOT EXISTS batch_runs_status_idx
  ON batch_runs (status);

CREATE INDEX IF NOT EXISTS batch_runs_fingerprint_created_at_idx
  ON batch_runs (run_fingerprint, created_at DESC);

CREATE TABLE IF NOT EXISTS batch_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES batch_runs(id) ON DELETE CASCADE,
  csv_row_number integer NOT NULL,
  raw_email text NOT NULL,
  normalized_email text NOT NULL,
  resolution_status text NOT NULL,
  resolution_reason text NULL,
  profile_id text NULL,
  public_name text NULL,
  profile_email text NULL,
  consent_status text NULL,
  profile_status text NULL,
  canonical_message_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES batch_runs(id) ON DELETE CASCADE,
  source_recipient_id uuid NOT NULL REFERENCES batch_recipients(id) ON DELETE CASCADE,
  profile_id text NOT NULL,
  recipient_email text NOT NULL,
  template_public_name text NULL,
  template_email text NOT NULL,
  rendered_subject text NULL,
  rendered_plain_text text NULL,
  rendered_rich_text text NULL,
  schedule_at timestamptz NOT NULL,
  send_status text NOT NULL,
  send_attempt_count integer NOT NULL DEFAULT 0,
  external_message_id text NULL,
  sent_order_index integer NULL,
  sent_at timestamptz NULL,
  send_error text NULL,
  delivery_event_type text NULL,
  delivery_event_status text NULL,
  delivery_event_payload jsonb NULL,
  delivery_event_at timestamptz NULL,
  last_delivery_sync_attempt_at timestamptz NULL,
  successful boolean NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE batch_recipients
  DROP CONSTRAINT IF EXISTS batch_recipients_canonical_message_id_fkey;

ALTER TABLE batch_recipients
  ADD CONSTRAINT batch_recipients_canonical_message_id_fkey
  FOREIGN KEY (canonical_message_id)
  REFERENCES batch_messages(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS batch_recipients_run_id_idx
  ON batch_recipients (run_id);

CREATE UNIQUE INDEX IF NOT EXISTS batch_messages_run_profile_id_idx
  ON batch_messages (run_id, profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS batch_messages_run_sent_order_idx
  ON batch_messages (run_id, sent_order_index)
  WHERE sent_order_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS batch_messages_external_message_id_idx
  ON batch_messages (external_message_id);

CREATE INDEX IF NOT EXISTS batch_messages_run_send_status_sent_at_idx
  ON batch_messages (run_id, send_status, sent_at);