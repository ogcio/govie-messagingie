import { promises as fs } from "node:fs";
import path from "node:path";
import { httpErrors } from "@fastify/sensible";
import { getErrorMessage } from "@ogcio/shared-errors";

export async function getPackageInfo(): Promise<{
  version: string;
  name: string;
}> {
  try {
    // Resolve the path to package.json
    const packageJsonPath = path.resolve("package.json");

    // Read the file content as a string
    const data = await fs.readFile(packageJsonPath, "utf-8");

    // Parse the JSON content
    const packageJson = JSON.parse(data);

    // Log or return the parsed content
    return { version: packageJson.version, name: packageJson.name };
  } catch (err) {
    throw httpErrors.internalServerError(getErrorMessage(err));
  }
}
