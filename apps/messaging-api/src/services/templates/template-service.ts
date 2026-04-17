import { httpErrors } from "@fastify/sensible";
import type { Pool, PoolClient } from "pg";
import type {
  AvailableLanguages,
  PaginationParams,
} from "../../types/schemaDefinitions.js";
import type {
  CreateTemplateReqBody,
  GetTemplateResponseItem,
  ListTemplatesResponseItem,
  UpdateTemplateReqBody,
} from "../../types/templates.js";

type ListTemplatesResponse = {
  data: ListTemplatesResponseItem[];
  totalCount: number;
};

export async function listTemplates(params: {
  pool: Pool;
  pagination: Required<PaginationParams>;
  search?: string;
  organizationId: string;
}): Promise<ListTemplatesResponse> {
  const values = [
    params.organizationId,
    params.pagination.limit,
    params.pagination.offset,
  ];
  let searchQuery = "";

  if (params.search) {
    searchQuery = "AND c.template_name ilike $4";
    values.push(`%${params.search}%`);
  }

  const query = `
    WITH meta_count as(
      select count(distinct(m.id)) FROM message_template_meta m
      join message_template_contents c on c.template_meta_id = m.id
      WHERE 
        organisation_id = $1 
        AND deleted_at is null
        ${searchQuery}
    )
    SELECT  
      m.id as "templateMetaId",
      (
        SELECT jsonb_agg(jsonb_build_object('templateName', template_name, 'language', c.lang)) 
          FROM message_template_contents c 
          WHERE template_meta_id = id
      ) as "contents",
      (SELECT count from meta_count) as "count",
      (SELECT created_at FROM message_template_contents c WHERE c.template_meta_id = id LIMIT 1)
    FROM message_template_meta m
    join message_template_contents c on c.template_meta_id = m.id
    WHERE
      organisation_id = $1 AND
      m.deleted_at is null
      ${searchQuery}
    GROUP BY "templateMetaId"
    ORDER BY created_at DESC
    LIMIT $2
    OFFSET $3
  `;

  const result = await params.pool.query<{
    templateMetaId: string;
    contents: { language: AvailableLanguages; templateName: string }[];
    count: number;
  }>(query, values);

  const data: ListTemplatesResponseItem[] = [];

  for (const row of result.rows) {
    data.push({ id: row.templateMetaId, contents: row.contents });
  }

  const totalCount = result.rows.at(0)?.count || 0;

  return { data, totalCount };
}

export async function getTemplate(params: {
  pool: Pool;
  templateId: string;
  organizationId: string;
}): Promise<GetTemplateResponseItem> {
  const templateMeta = await params.pool.query<{
    templateName: string;
    subject: string;
    excerpt: string | null;
    plainText: string;
    richText: string | null;
    language: string;
    fieldName?: string;
  }>(
    `
        SELECT
            template_name as "templateName",
            subject,
            excerpt,
            plain_text as "plainText",
            rich_text as "richText",
            lang as "language",
            v.field_name as "fieldName"
        FROM message_template_meta m
        JOIN message_template_contents c on c.template_meta_id = m.id
        LEFT JOIN message_template_variables v on v.template_meta_id = m.id
        WHERE m.id = $1 AND m.organisation_id = $2 AND m.deleted_at is null;
    `,
    [params.templateId, params.organizationId],
  );

  const outputTemplate: GetTemplateResponseItem = {
    contents: [],
    fields: [],
  };

  for (const row of templateMeta.rows) {
    const {
      excerpt,
      plainText,
      richText,
      subject,
      templateName,
      fieldName,
      language,
    } = row;

    const content = outputTemplate.contents?.find(
      (content) => content.language === language,
    );

    // if already exists, update it
    if (content) {
      content.excerpt = excerpt ?? undefined;
      content.plainText = plainText;
      content.richText = richText ?? undefined;
      content.subject = subject;
      content.templateName = templateName;
    } else {
      outputTemplate.contents.push({
        excerpt: excerpt ?? undefined,
        language,
        plainText,
        richText: richText ?? undefined,
        subject,
        templateName,
      });
    }

    if (
      fieldName &&
      !outputTemplate.fields.some((field) => field.fieldName === fieldName)
    ) {
      outputTemplate.fields.push({ fieldName });
    }
  }

  if (!outputTemplate.contents.length) {
    throw httpErrors.notFound("no template found");
  }

  return outputTemplate;
}

export async function createTemplate(params: {
  pool: Pool;
  inputBody: CreateTemplateReqBody;
  userId: string;
  organizationId: string;
}): Promise<string> {
  const { pool, inputBody, userId, organizationId } = params;

  await ensureTemplateNameDoesntExist({ pool, inputBody, organizationId });
  // Can of course create a huge CTE here.
  const client = await pool.connect();
  try {
    client.query("BEGIN");

    const templateMetaId = await createTemplateMeta({
      client,
      userId,
      organizationId,
    });
    await createTemplateContent({ client, templateMetaId, inputBody });

    await client.query("COMMIT");

    return templateMetaId;
  } catch (err) {
    client.query("ROLLBACK");
    throw httpErrors.createError(500, "failed to create template", {
      parent: err,
    });
  } finally {
    client.release();
  }
}

export async function updateTemplate(params: {
  pool: Pool;
  inputBody: UpdateTemplateReqBody;
  templateId: string;
  organizationId: string;
}): Promise<void> {
  const { pool, inputBody, organizationId, templateId } = params;
  // adding this will return 404
  // if template does not exist
  await getTemplate({ pool, templateId, organizationId });

  await ensureTemplateNameDoesntExist({
    pool,
    organizationId,
    templateIdToIgnore: templateId,
    inputBody,
  });
  const client = await pool.connect();
  try {
    client.query("BEGIN");

    await client.query(
      `
          DELETE from message_template_contents
          WHERE template_meta_id = $1
      `,
      [templateId],
    );
    // Flush all variables and re-insert. Easier than figuring out which has been modified, added or removed
    await client.query(
      `
              DELETE from message_template_variables
              WHERE template_meta_id = $1
          `,
      [templateId],
    );
    await createTemplateContent({
      client,
      templateMetaId: templateId,
      inputBody,
    });

    await client.query("COMMIT");
  } catch (error) {
    client.query("ROLLBACK");
    throw httpErrors.createError(500, "failed to update template", {
      parent: error,
    });
  } finally {
    client.release();
  }
}

export async function deleteTemplate(params: {
  organizationId: string;
  templateId: string;
  pool: Pool;
}) {
  const template = await getTemplate(params);

  const client = await params.pool.connect();
  try {
    await client.query("BEGIN");
    const updatePromises: Promise<unknown>[] = [];
    for (const content of template.contents) {
      const updatedName = `${content.templateName}-deleted-${Date.now()}`;
      updatePromises.push(
        client.query(
          `
            UPDATE message_template_contents
            SET template_name = $1
            WHERE template_meta_id = $2 AND lang = $3
        `,
          [updatedName, params.templateId, content.language],
        ),
      );
    }
    await Promise.all(updatePromises);

    await client.query(
      `
        UPDATE message_template_meta
        SET deleted_at=now()
        WHERE id = $1 AND organisation_id = $2;
    `,
      [params.templateId, params.organizationId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureTemplateNameDoesntExist(params: {
  pool: Pool;
  inputBody: CreateTemplateReqBody;
  organizationId: string;
  templateIdToIgnore?: string;
}): Promise<void> {
  const queryFilter: string[] = [];
  const values: string[] = [params.organizationId];
  let index = 1;
  for (const { templateName, language: lang } of params.inputBody.contents) {
    queryFilter.push(
      `(lower(template_name) = lower($${++index}) AND lang=$${++index})`,
    );
    values.push(templateName, lang);
  }
  let templateIdToIgnoreWhere = "";
  if (params.templateIdToIgnore) {
    templateIdToIgnoreWhere = ` AND m.id != $${++index} `;
    values.push(params.templateIdToIgnore);
  }

  // Let's check so that the template name isn't taken for the organisation
  const templateNameExists = await params.pool.query<{ exists: boolean }>(
    `
        SELECT exists(SELECT 1 FROM message_template_meta m 
          JOIN message_template_contents c on c.template_meta_id = m.id
          WHERE organisation_id = $1 ${templateIdToIgnoreWhere}
          AND (${queryFilter.join(" OR ")})
          LIMIT 1
        );
    `,
    values,
  );

  if (templateNameExists.rows[0]?.exists) {
    throw httpErrors.createError(422, "Template name already exists", {
      validation: [
        {
          fieldName: "templateName",
          message: "alreadyInUse",
          validationRule: "already-in-use",
        },
      ],
    });
  }
}

async function createTemplateMeta(params: {
  client: PoolClient;
  userId: string;
  organizationId: string;
}): Promise<string> {
  const templateMetaResponse = await params.client.query<{ id: string }>(
    `
        INSERT INTO message_template_meta(organisation_id, created_by_user_id)
        VALUES($1,$2)
        returning id
    `,
    [params.organizationId, params.userId],
  );
  const templateMetaId = templateMetaResponse.rows.at(0)?.id;

  if (!templateMetaId) {
    throw httpErrors.internalServerError("failed to create a template meta");
  }

  return templateMetaId;
}

async function createTemplateContent(params: {
  client: PoolClient;
  templateMetaId: string;
  inputBody: CreateTemplateReqBody;
}) {
  const { inputBody, client, templateMetaId } = params;
  const { contents, variables } = inputBody;

  for (const content of contents) {
    const {
      excerpt,
      language: lang,
      templateName,
      plainText,
      richText,
      subject,
    } = content;
    await client.query(
      `
            INSERT INTO message_template_contents(
              template_meta_id, 
              template_name,
              lang,
              subject,
              excerpt,
              rich_text,
              plain_text
              )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7
            )
          `,
      [
        templateMetaId,
        templateName,
        lang,
        subject,
        excerpt,
        richText,
        plainText,
      ],
    );
  }

  for (const field of variables || []) {
    await client.query(
      `
            INSERT INTO message_template_variables(template_meta_id, field_name)
            VALUES($1, $2)
          `,
      [templateMetaId, field.name],
    );
  }
}
