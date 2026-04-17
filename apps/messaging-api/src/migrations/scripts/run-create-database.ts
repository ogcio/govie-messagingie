import { createDatabase } from "./create-database.js";
import { getDbEnvs } from "./shared.js";

createDatabase(getDbEnvs());
