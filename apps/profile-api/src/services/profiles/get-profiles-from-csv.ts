import { existsSync } from "node:fs";
import { httpErrors } from "@fastify/sensible";
import { parseFile } from "fast-csv";
import { Type } from "typebox";
import Value from "typebox/value";
import {
  type ImportProfilesImportType,
  ImportProfilesImportTypesEnum,
} from "~/schemas/profiles/import-profiles.js";
import {
  type KnownProfileDataDetails,
  MandatoryProfileDataDetailsSchema,
  type PpsnOnlyProfileDataDetails,
  PpsnOnlyProfileDataDetailsSchema,
} from "~/schemas/profiles/model.js";
import { normalizeCsvValue } from "~/utils/csv/normalize-csv-value.js";

type ProfileRow = KnownProfileDataDetails;
type PpsnOnlyProfileRow = PpsnOnlyProfileDataDetails;

export const getProfilesFromCsv = async (
  filePath: string,
  importType: ImportProfilesImportType = ImportProfilesImportTypesEnum.Full,
): Promise<ProfileRow[] | PpsnOnlyProfileRow[]> => {
  if (!existsSync(filePath)) {
    throw httpErrors.internalServerError(`Csv ${filePath} does not exist`);
  }
  try {
    const records: ProfileRow[] | PpsnOnlyProfileRow[] = [];
    const parser = parseFile<
      ProfileRow | PpsnOnlyProfileRow,
      ProfileRow[] | PpsnOnlyProfileRow[]
    >(filePath, {
      headers: true,
    }).transform(
      (
        props: ProfileRow | PpsnOnlyProfileRow,
      ): (ProfileRow | PpsnOnlyProfileRow) | null => {
        return importType === ImportProfilesImportTypesEnum.PpsnOnly
          ? normalizePpsnOnlyCsvRow(props as PpsnOnlyProfileRow)
          : normalizeCsvRow(props as ProfileRow);
      },
    );

    for await (const row of parser) {
      records.push(row);
    }

    if (records.length === 0) {
      throw new Error("Csv must contain at least one line");
    }

    if (importType === ImportProfilesImportTypesEnum.PpsnOnly) {
      Value.Assert(Type.Array(PpsnOnlyProfileDataDetailsSchema), records);
    } else {
      Value.Assert(Type.Array(MandatoryProfileDataDetailsSchema), records);
    }

    return records;
  } catch (error) {
    throw httpErrors.unprocessableEntity(`Failed to parse CSV file: ${error}`);
  }
};

const normalizePpsnOnlyCsvRow = (
  row: PpsnOnlyProfileRow,
): PpsnOnlyProfileRow => ({
  ppsn: normalizeCsvValue(row.ppsn) as string,
});

const normalizeCsvRow = (row: KnownProfileDataDetails): ProfileRow => ({
  firstName: normalizeCsvValue(row.firstName) as string,
  lastName: normalizeCsvValue(row.lastName) as string,
  phone: normalizeCsvValue(row.phone),
  dateOfBirth: normalizeCsvValue(row.dateOfBirth),
  email: normalizeCsvValue(row.email) as string,
  address: normalizeCsvValue(row.address),
  city: normalizeCsvValue(row.city),
  ppsn: normalizeCsvValue(row.ppsn),
  preferredLanguage: normalizeCsvValue(row.preferredLanguage) as
    | "en"
    | "ga"
    | undefined,
  externalId: normalizeCsvValue(row.externalId),
});
