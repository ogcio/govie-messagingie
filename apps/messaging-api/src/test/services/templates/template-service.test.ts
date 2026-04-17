import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from "../../../services/templates/template-service.js";
import type {
  CreateTemplateReqBody,
  UpdateTemplateReqBody,
} from "../../../types/templates.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../../build-testcontainer-pg.js";

let pool: Pool;

beforeAll(() => {
  pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

const organizationId = "test-organization-id";
const userId = "test-user-id";

describe("Template Service", () => {
  it("should list templates", async () => {
    const pagination = { limit: "10", offset: "0" };
    const response = await listTemplates({
      pool,
      pagination,
      organizationId,
    });

    expect(response).toHaveProperty("data");
    expect(response).toHaveProperty("totalCount");
  });

  it("pagination works as expected", async () => {
    await Promise.all([createHelperTemplate(), createHelperTemplate()]);
    const pagination = { limit: "10", offset: "0" };
    const all = await listTemplates({
      pool,
      pagination,
      organizationId,
    });

    const firstPagination = { limit: "1", offset: "0" };
    const first = await listTemplates({
      pool,
      pagination: firstPagination,
      organizationId,
    });

    const secondPagination = { limit: "1", offset: "1" };
    const second = await listTemplates({
      pool,
      pagination: secondPagination,
      organizationId,
    });

    expect(first.data.length).toEqual(1);
    expect(second.data.length).toEqual(1);
    expect(first.data[0].id).toEqual(all.data[0].id);
    expect(second.data[0].id).toEqual(all.data[1].id);
  });

  it("should get a template", async () => {
    const created = await createHelperTemplate();
    const response = await getTemplate({
      pool,
      templateId: created.id,
      organizationId,
    });

    expect(response.contents).toEqual(created.created.contents);
    expect(response.fields.length).toEqual(created.created.variables?.length);
  });

  it("getting a not existent template returns 404", async () => {
    const templateId = randomUUID();

    await expect(
      getTemplate({
        pool,
        templateId,
        organizationId,
      }),
    ).rejects.toThrowError("no template found");
  });

  it("should create a template", async () => {
    const createdTemplate = await createHelperTemplate();

    const template = await getTemplate({
      pool,
      templateId: createdTemplate.id,
      organizationId,
    });

    expect(template.contents).toEqual(createdTemplate.created.contents);
    expect(template.fields.length).toEqual(
      createdTemplate.created.variables?.length,
    );
  });

  it("should find correct templates by using search query parameter", async () => {
    const templateNameEn = crypto.randomUUID();
    const templateNameGa = crypto.randomUUID();
    const createdTemplate = await createHelperTemplate({
      body: {
        contents: [
          {
            excerpt: "ex en",
            language: "en",
            plainText: "pt en",
            richText: "rt en",
            subject: "s en",
            templateName: templateNameEn,
          },
          {
            excerpt: "ex ga",
            language: "ga",
            plainText: "pt ga",
            richText: "rt ga",
            subject: "s ga",
            templateName: templateNameGa,
          },
        ],
      },
    });

    const templateEn = await listTemplates({
      pool,
      organizationId,
      pagination: { limit: "20", offset: "0" },
      search: templateNameEn,
    });
    const templateGa = await listTemplates({
      pool,
      organizationId,
      pagination: { limit: "20", offset: "0" },
      search: templateNameGa,
    });

    expect(templateEn.totalCount).toBe("1");
    expect(templateEn.data.at(0)?.id).toEqual(createdTemplate.id);
    expect(templateEn.data.at(0)?.contents.at(0)?.templateName).toEqual(
      templateNameEn,
    );
    expect(templateEn.data.at(0)?.contents.at(0)?.language).toEqual("en");

    expect(templateEn.data.at(0)?.contents.at(1)?.templateName).toEqual(
      templateNameGa,
    );
    expect(templateEn.data.at(0)?.contents.at(1)?.language).toEqual("ga");

    expect(templateGa.data.at(0)?.id).toEqual(createdTemplate.id);
    expect(templateGa.totalCount).toBe("1");
    expect(templateGa.data.at(0)?.contents.at(0)?.templateName).toEqual(
      templateNameEn,
    );
    expect(templateGa.data.at(0)?.contents.at(0)?.language).toEqual("en");

    expect(templateGa.data.at(0)?.contents.at(1)?.templateName).toEqual(
      templateNameGa,
    );
    expect(templateGa.data.at(0)?.contents.at(1)?.language).toEqual("ga");
  });

  it("should get empty list if search param wasn't matching anything", async () => {
    const list = await listTemplates({
      pool,
      organizationId,
      pagination: { limit: "20", offset: "0" },
      search: crypto.randomUUID(),
    });
    expect(list.totalCount).toEqual(0);
    expect(list.data).toHaveLength(0);
  });

  it("creating a template with already existent name throw error", async () => {
    const createdTemplate = await createHelperTemplate();

    await expect(
      createTemplate({
        pool,
        inputBody: createdTemplate.created,
        userId,
        organizationId,
      }),
    ).rejects.toThrow("Template name already exists");
  });

  it("can create a template with same name for other org", async () => {
    const createdTemplate = await createHelperTemplate();
    const anotherOrgCreatedId = await createTemplate({
      pool,
      inputBody: createdTemplate.created,
      userId,
      organizationId: "another-org-id",
    });

    const getAnotherTemplate = await getTemplate({
      pool,
      templateId: anotherOrgCreatedId,
      organizationId: "another-org-id",
    });

    expect(getAnotherTemplate.contents).toEqual(
      createdTemplate.created.contents,
    );
  });

  it("should update a template", async () => {
    const createdTemplate = await createHelperTemplate();
    const contentToUpdate = createdTemplate.created.contents[0];
    const inputBody: UpdateTemplateReqBody = {
      id: createdTemplate.id,
      contents: [
        {
          templateName: `${contentToUpdate.templateName}-up`,
          language: "en",
          subject: `${contentToUpdate.subject}-up`,
          excerpt: `${contentToUpdate.excerpt}-up`,
          plainText: `${contentToUpdate.plainText}-up`,
          richText: `${contentToUpdate.richText}-up`,
        },
      ],
      variables: [{ name: "variable-up" }],
    };

    await updateTemplate({
      pool,
      inputBody,
      templateId: createdTemplate.id,
      organizationId,
    });

    const updatedTemplate = await getTemplate({
      pool,
      templateId: createdTemplate.id,
      organizationId,
    });

    expect(updatedTemplate.contents).toEqual(inputBody.contents);
  });

  it("updating a template with already existent name throw error", async () => {
    const alreadyExistent = await createHelperTemplate();
    const toUpdate = await createHelperTemplate();
    await expect(
      updateTemplate({
        pool,
        inputBody: { ...alreadyExistent.created, id: toUpdate.id },
        templateId: toUpdate.id,
        organizationId,
      }),
    ).rejects.toThrow("Template name already exists");
  });

  it("can update a template with same name for other org", async () => {
    const createdTemplate = await createHelperTemplate();
    const anotherOrgCreated = await createHelperTemplate({
      organizationId: "another-org-id",
    });

    await updateTemplate({
      pool,
      inputBody: { ...createdTemplate.created, id: anotherOrgCreated.id },
      templateId: anotherOrgCreated.id,
      organizationId: "another-org-id",
    });

    const getUpdated = await getTemplate({
      pool,
      templateId: anotherOrgCreated.id,
      organizationId: "another-org-id",
    });

    expect(getUpdated.contents).toEqual(createdTemplate.created.contents);
  });

  it("should delete a template", async () => {
    const createdTemplate = await createHelperTemplate();

    await deleteTemplate({
      pool,
      templateId: createdTemplate.id,
      organizationId,
    });

    await expect(
      getTemplate({ pool, templateId: createdTemplate.id, organizationId }),
    ).rejects.toThrow("no template found");
  });

  it("creating a template with already existent name but deleted works fine", async () => {
    const createdTemplate = await createHelperTemplate();
    await deleteTemplate({
      pool,
      templateId: createdTemplate.id,
      organizationId,
    });

    const recreatedTemplateId = await createTemplate({
      pool,
      inputBody: createdTemplate.created,
      userId,
      organizationId,
    });

    expect(recreatedTemplateId).toBeDefined();
  });

  it("deleting a not existent template returns 404", async () => {
    const templateId = randomUUID();

    await expect(
      deleteTemplate({
        pool,
        templateId,
        organizationId,
      }),
    ).rejects.toThrowError("no template found");
  });
});

async function createHelperTemplate(params?: {
  userId?: string;
  organizationId?: string;
  body?: CreateTemplateReqBody;
}): Promise<{
  created: CreateTemplateReqBody;
  id: string;
}> {
  const toUseUserId = params?.userId || userId;
  const toUseOrganizationId = params?.organizationId || organizationId;
  const random = Math.floor(Math.random() * 10000);
  const inputBody: CreateTemplateReqBody = params?.body || {
    contents: [
      {
        templateName: `Test Template ${random}`,
        language: "en",
        subject: `Test Subject ${random}`,
        excerpt: `Test Excerpt ${random}`,
        plainText: `Test Plain Text ${random}`,
        richText: `Test Rich Text ${random}`,
      },
    ],
    variables: [{ name: `variable${random}` }],
  };

  return {
    id: await createTemplate({
      pool,
      inputBody,
      userId: toUseUserId,
      organizationId: toUseOrganizationId,
    }),
    created: inputBody,
  };
}
