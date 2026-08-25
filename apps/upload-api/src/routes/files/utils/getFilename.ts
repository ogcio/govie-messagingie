import type fastifyPostgres from "@fastify/postgres";

const isFilenameAlreadyPresent = async (
  pg: fastifyPostgres.PostgresDb,
  userId: string,
  filename: string,
) => {
  const clashingFileCheckQuery = await pg.query(
    `
    SELECT file_name as "fileName"
    FROM files
    WHERE deleted = false AND owner = $1 AND file_name = $2
  `,
    [userId, filename],
  );

  return clashingFileCheckQuery.rows.length > 0;
};

const getFilename = async (
  pg: fastifyPostgres.PostgresDb,
  inputFilename: string,
  userId: string,
) => {
  const fileExists = await isFilenameAlreadyPresent(pg, userId, inputFilename);

  if (!fileExists) {
    return inputFilename;
  }

  let clashingFileExists = true;
  let newFilename = "";
  while (clashingFileExists) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const randomIndex = Array.from(array, (b) =>
      b.toString(36).padStart(2, "0"),
    ).join("");
    const ext = inputFilename.slice(inputFilename.lastIndexOf("."));
    const name = inputFilename.slice(0, inputFilename.lastIndexOf("."));
    newFilename = `${name}-${randomIndex}${ext}`;

    const fileExists = await isFilenameAlreadyPresent(pg, userId, newFilename);

    if (!fileExists) {
      clashingFileExists = false;
    }
  }

  return newFilename;
};

export default getFilename;
