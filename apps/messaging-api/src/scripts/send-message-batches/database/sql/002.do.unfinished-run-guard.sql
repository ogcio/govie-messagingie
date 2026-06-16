WITH ranked_runs AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY run_fingerprint
      ORDER BY created_at DESC, id DESC
    ) AS run_rank
  FROM batch_runs
  WHERE status NOT IN (
    'completed',
    'completed_with_failures',
    'failed',
    'superseded'
  )
)
UPDATE batch_runs
SET
  status = 'superseded',
  completed_at = COALESCE(completed_at, now()),
  updated_at = now()
WHERE id IN (
  SELECT id
  FROM ranked_runs
  WHERE run_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS batch_runs_unfinished_fingerprint_uidx
  ON batch_runs (run_fingerprint)
  WHERE status NOT IN (
    'completed',
    'completed_with_failures',
    'failed',
    'superseded'
  );