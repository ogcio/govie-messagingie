CREATE TABLE IF NOT EXISTS message_event_summary (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	messaging_event_logs_id uuid NOT NULL,
	message_id uuid NOT NULL UNIQUE,
	organisation_id varchar(21) NOT NULL,
	subject text NOT NULL,
	event_status text NOT NULL,
	event_type text NOT NULL,
	"data" jsonb NULL,
	scheduled_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT message_event_summary_pkey PRIMARY KEY (id),
	CONSTRAINT message_event_summary_messages_fk FOREIGN KEY (message_id) REFERENCES messages(id),
	CONSTRAINT message_event_summary_event_logs_fk FOREIGN KEY (messaging_event_logs_id) REFERENCES messaging_event_logs(id)
);

CREATE INDEX IF NOT EXISTS message_event_summary_msgid_idx ON message_event_summary USING btree (message_id);
CREATE INDEX IF NOT EXISTS message_event_summary_orgid_idx ON message_event_summary USING btree (organisation_id);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX message_event_summary_idx_subject_trgm ON message_event_summary USING gin (subject gin_trgm_ops);