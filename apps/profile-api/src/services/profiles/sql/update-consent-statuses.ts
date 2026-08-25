import type { PoolClient, QueryResult } from "pg";
import type { CitizenSubmitConsentBody } from "~/schemas/consents/citizen.js";

export async function updateConsentStatuses(params: {
  profileId: string;
  client: PoolClient;
  consentInput: CitizenSubmitConsentBody;
}): Promise<QueryResult<{ id: string }>> {
  return params.client.query<{ id: string }>(
    `
  UPDATE profiles 
    SET consent_statuses = COALESCE(consent_statuses, '{}'::jsonb) 
      || jsonb_build_object(
          $2::text, 
          jsonb_build_object(
            'status', $3::text,
            'consent_statement_id', $4::text
          )
        )
  WHERE id = $1 
  RETURNING id;
  `,
    [
      params.profileId,
      params.consentInput.subject,
      params.consentInput.status,
      params.consentInput.consentStatementId,
    ],
  );
}
