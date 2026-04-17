BEGIN;

CREATE TABLE IF NOT EXISTS email_providers (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	provider_name text NOT NULL,
	smtp_host text NOT NULL,
	smtp_port int2 NOT NULL,
	username text NOT NULL,
	pw text NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	throttle_ms int4 NULL,
	from_address text NOT NULL,
	is_ssl bool DEFAULT false NULL,
	organisation_id varchar(21) NULL,
	is_primary bool NULL,
	deleted_at timestamptz NULL,
	CONSTRAINT email_providers_is_primary_check CHECK (((is_primary IS NULL) OR (is_primary IS TRUE))),
	CONSTRAINT email_providers_organisation_id_from_address_key UNIQUE (organisation_id, from_address),
	CONSTRAINT email_providers_organisation_id_is_primary_key UNIQUE (organisation_id, is_primary),
	CONSTRAINT email_providers_organisation_id_provider_name_key UNIQUE (organisation_id, provider_name),
	CONSTRAINT email_providers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS jobs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id varchar(128) NOT NULL,
	job_id uuid NOT NULL,
	job_type text NOT NULL,
	delivery_status text NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	organisation_id text NULL,
	job_token text NULL,
	CONSTRAINT jobs_pk PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS message_template_meta (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organisation_id varchar(21) NOT NULL,
	created_by_user_id varchar(128) NOT NULL,
	deleted_at timestamptz NULL,
	CONSTRAINT message_template_meta_pk PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS messages (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	organisation_id varchar(21) NOT NULL,
	user_id varchar(12) NOT NULL,
	is_delivered bool DEFAULT false NOT NULL,
	thread_name text NULL,
	lang text NOT NULL,
	is_seen bool DEFAULT false NULL,
	security_level text DEFAULT 'high'::text NOT NULL,
	subject text NOT NULL,
	excerpt text NOT NULL,
	rich_text text NOT NULL,
	plain_text text NOT NULL,
	preferred_transports _text NULL,
	updated_at timestamptz DEFAULT now() NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	scheduled_at timestamptz NULL,
	sender_user_id varchar(12) NULL,
	CONSTRAINT messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS attachments_messages (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	message_id uuid NOT NULL,
	attachment_id uuid NOT NULL,
	CONSTRAINT attachments_messages_pk PRIMARY KEY (id),
	CONSTRAINT attachments_messages_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS message_template_contents (
	template_meta_id uuid NOT NULL,
	template_name text NOT NULL,
	lang text NOT NULL,
	subject text NOT NULL,
	excerpt text NOT NULL,
	rich_text text NOT NULL,
	plain_text text NOT NULL,
	updated_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT message_template_contents_pkey PRIMARY KEY (template_meta_id, lang),
	CONSTRAINT message_template_contents_message_template_meta_fk FOREIGN KEY (template_meta_id) REFERENCES message_template_meta(id)
);

CREATE TABLE IF NOT EXISTS message_template_variables (
	template_meta_id uuid NOT NULL,
	field_name text NOT NULL,
	CONSTRAINT message_template_variables_pkey PRIMARY KEY (template_meta_id, field_name),
	CONSTRAINT message_template_variables_message_template_meta_fk FOREIGN KEY (template_meta_id) REFERENCES message_template_meta(id)
);

CREATE TABLE IF NOT EXISTS messaging_event_logs (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	message_id uuid NOT NULL,
	event_status text NOT NULL,
	event_type text NOT NULL,
	"data" jsonb NULL,
	created_at timestamptz DEFAULT now() NULL,
	CONSTRAINT messaging_event_logs_pkey PRIMARY KEY (id),
	CONSTRAINT messaging_event_logs_messages_fk FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS messaging_event_logs_msgid_idx ON messaging_event_logs USING btree (message_id);

COMMIT;