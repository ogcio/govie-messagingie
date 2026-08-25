import type { Pool } from "pg";
import pino from "pino";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { submitConsent } from "~/services/consents/consents-service.js";

export async function syncProfileConsents(pool: Pool): Promise<void> {
  const batchSize = 500;
  try {
    const consentStatement = await getCurrentConsentStatement({
      pool,
      subject: ConsentSubjects.Messaging,
    });
    const consentStatementId = consentStatement.id;
    console.log("Syncing profile consent");

    let offset = 0;
    let hasMore = true;

    // To avoid overflows we perform multiple transactions
    while (hasMore) {
      const nullConsentSatusesQuery = `
        SELECT id
        FROM profiles
        WHERE consent_statuses is NULL
        -- Do not update children directly,
        -- submitConsent will take care of them
        AND id = primary_user_id
        ORDER BY id
        LIMIT $1 
        OFFSET $2
      `;

      const { rows: nullConsentStatusesRows } = await pool.query<{
        id: string;
      }>(nullConsentSatusesQuery, [batchSize, offset]);

      if (nullConsentStatusesRows.length === 0) {
        hasMore = false;
        continue;
      }

      console.log(
        `Processing batch of ${nullConsentStatusesRows.length} profiles starting at offset ${offset}`,
      );

      try {
        const promises: Promise<{ id: string }>[] = [];
        for (const nullConsentProfile of nullConsentStatusesRows) {
          console.log(
            `Syncing consent status for profile ${nullConsentProfile.id}`,
          );

          promises.push(
            submitConsent({
              pool,
              logger: pino.pino(),
              userId: nullConsentProfile.id,
              consentInput: {
                subject: ConsentSubjects.Messaging,
                status: ConsentStatuses.PreApproved,
                consentStatementId,
              },
              reason: CascadeConsentReasons.ManualAdminAction,
            }),
          );

          if (promises.length >= 20) {
            console.log("Awaiting for insert to be executed...");
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        // Process remaining promises in the batch
        if (promises.length > 0) {
          console.log(
            "Awaiting for insert to be executed at the end of the batch...",
          );
          await Promise.all(promises);
        }

        console.log(`Successfully committed batch at offset ${offset}`);
      } catch (err) {
        console.error(
          `Error processing batch at offset ${offset}, rolling back:`,
          err,
        );
        throw err;
      }

      offset += batchSize;
    }

    console.log("Successfully completed sync profile consent");
  } catch (e) {
    if (typeof e === "object" && e?.constructor.name === "NotFoundError") {
      console.log(
        "No current consent statement found for subject Messaging, skipping profile consent sync.",
      );
      return;
    }
    console.error("Error while syncing profile consent:", e);
    throw e;
  }
}
