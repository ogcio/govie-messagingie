import { dropDatabase } from "./drop-database.js";
import { getDbEnvs } from "./shared.js";

dropDatabase(getDbEnvs());
