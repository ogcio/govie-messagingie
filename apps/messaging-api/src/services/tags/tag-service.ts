import { httpErrors } from "@fastify/sensible";
import type { Pool, PoolClient } from "pg";
import type {
  CreateTagBody,
  Tag,
  TagTreeNode,
  UpdateTagBody,
} from "../../types/tags.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Using this query runner methods will accept either pool or pool client */
type QueryRunner = { query: Pool["query"] } | { query: PoolClient["query"] };

/** Common SELECT columns for tag queries. */
const TAG_COLUMNS = `t.id, t.user_id as "userId", t.label, t.parent_tag_id as "parentTagId", t.path::text as path, t.created_at as "createdAt", t.updated_at as "updatedAt"`;

/** Strip hyphens from a UUID so it's a valid ltree label. */
function uuidToLtreeSegment(uuid: string): string {
  return uuid.replace(/-/g, "");
}

/** Detect Postgres unique-violation and re-throw as 409 Conflict. */
function handleUniqueViolation(error: unknown): never {
  if (
    error instanceof Error &&
    (error as Error & { code?: string }).code === "23505"
  ) {
    throw httpErrors.conflict(
      "A tag with this name already exists under the same parent",
    );
  }
  throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// getTagById
// ─────────────────────────────────────────────────────────────────────────────

export async function getTagById(
  pool: QueryRunner,
  userId: string,
  tagId: string,
): Promise<Tag> {
  const result = await pool.query<Tag>(
    `SELECT ${TAG_COLUMNS}
     FROM tags t
     WHERE t.id = $1 AND t.user_id = $2`,
    [tagId, userId],
  );

  if (result.rows.length === 0) {
    throw httpErrors.notFound("Tag not found");
  }

  return result.rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// createTag
// ─────────────────────────────────────────────────────────────────────────────

export async function createTag(
  pool: QueryRunner,
  userId: string,
  body: CreateTagBody,
): Promise<{ id: string }> {
  let parentPath: string | null = null;

  if (body.parentTagId) {
    const parentResult = await pool.query<{ path: string }>(
      `SELECT path::text FROM tags WHERE id = $1 AND user_id = $2`,
      [body.parentTagId, userId],
    );

    if (parentResult.rows.length === 0) {
      throw httpErrors.badRequest("Parent tag not found or not owned by user");
    }

    parentPath = parentResult.rows[0].path;
  }

  try {
    const result = await pool.query<{ id: string; path: string }>(
      `INSERT INTO tags (user_id, label, parent_tag_id, path)
       VALUES ($1, $2, $3, ($4 || CASE WHEN $4 = '' THEN '' ELSE '.' END || replace(gen_random_uuid()::text, '-', ''))::ltree)
       RETURNING id, path::text`,
      [userId, body.label, body.parentTagId ?? null, parentPath ?? ""],
    );

    return { id: result.rows[0].id };
  } catch (error) {
    handleUniqueViolation(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateTag
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTag(
  pool: QueryRunner,
  userId: string,
  tagId: string,
  body: UpdateTagBody,
): Promise<{ id: string }> {
  // Fetch the existing tag
  const tag = await getTagById(pool, userId, tagId);

  const newLabel = body.label ?? tag.label;

  // Determine if parent is changing
  const parentChanging = body.parentTagId !== undefined;
  const newParentTagId = parentChanging ? body.parentTagId : tag.parentTagId;

  if (parentChanging) {
    // Prevent setting self as parent
    if (newParentTagId === tagId) {
      throw httpErrors.badRequest("A tag cannot be its own parent");
    }

    // If moving to a non-null parent, validate it exists and is not a descendant
    let resolvedParentPath = "";
    if (newParentTagId !== null && newParentTagId !== undefined) {
      const parentResult = await getTagById(pool, userId, newParentTagId);

      resolvedParentPath = parentResult.path;

      // Check if the new parent is a descendant of this tag (circular reference)
      const isDescendant = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM tags
           WHERE id = $1 AND path <@ $2::ltree
         ) AS exists`,
        [newParentTagId, tag.path],
      );

      if (isDescendant.rows[0].exists) {
        throw httpErrors.badRequest(
          "Cannot move a tag under one of its own descendants",
        );
      }
    }

    // Recompute paths: this tag and all descendants
    const selfSegment = uuidToLtreeSegment(tagId);
    const newPath = resolvedParentPath
      ? `${resolvedParentPath}.${selfSegment}`
      : selfSegment;

    try {
      await pool.query(
        `UPDATE tags
         SET path = CASE
               WHEN path = $2::ltree THEN $1::ltree
               ELSE $1::ltree || subpath(path, nlevel($2::ltree))
             END,
             parent_tag_id = CASE WHEN id = $3 THEN $4 ELSE parent_tag_id END,
             label = CASE WHEN id = $3 THEN $5 ELSE label END,
             updated_at = now()
         WHERE path <@ $2::ltree AND user_id = $6`,
        [newPath, tag.path, tagId, newParentTagId, newLabel, userId],
      );
    } catch (error) {
      handleUniqueViolation(error);
    }
  } else {
    // Only label is changing
    try {
      await pool.query(
        `UPDATE tags SET label = $1, updated_at = now() WHERE id = $2 AND user_id = $3`,
        [newLabel, tagId, userId],
      );
    } catch (error) {
      handleUniqueViolation(error);
    }
  }

  return { id: tagId };
}

// ─────────────────────────────────────────────────────────────────────────────
// listTags
// ─────────────────────────────────────────────────────────────────────────────

export async function listTags(
  pool: QueryRunner,
  userId: string,
): Promise<Tag[]> {
  const result = await pool.query<Tag>(
    `SELECT ${TAG_COLUMNS}
     FROM tags t
     WHERE t.user_id = $1
     ORDER BY t.label`,
    [userId],
  );

  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// getTagTree
// ─────────────────────────────────────────────────────────────────────────────

export async function getTagTree(
  pool: QueryRunner,
  userId: string,
): Promise<TagTreeNode[]> {
  const result = await pool.query<Tag & { unreadMessages: number }>(
    `SELECT ${TAG_COLUMNS},
            COALESCE(COUNT(m.id) FILTER (WHERE m.is_seen = false), 0)::int AS "unreadMessages"
     FROM tags t
     LEFT JOIN messages m ON m.tag_id = t.id
     WHERE t.user_id = $1
     GROUP BY t.id
     ORDER BY t.label`,
    [userId],
  );

  return buildTree(result.rows);
}

function buildTree(rows: (Tag & { unreadMessages: number })[]): TagTreeNode[] {
  const nodeMap = new Map<string, TagTreeNode>();
  const roots: TagTreeNode[] = [];

  // Create all nodes
  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      label: row.label,
      unreadMessages: row.unreadMessages,
      children: [],
    });
  }

  // Build hierarchy
  for (const row of rows) {
    const node = nodeMap.get(row.id);
    if (!node) continue;
    const parent = row.parentTagId ? nodeMap.get(row.parentTagId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteTag
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteTag(
  pool: QueryRunner,
  userId: string,
  tagId: string,
): Promise<{ id: string }> {
  // Fetch the tag to get its path
  const tagResult = await getTagById(pool, userId, tagId);

  const tagPath = tagResult.path;

  // Check if this tag or any descendant has messages attached
  const hasMessages = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM messages m
       JOIN tags t ON m.tag_id = t.id
       WHERE t.path <@ $1::ltree AND t.user_id = $2
     ) AS exists`,
    [tagPath, userId],
  );

  if (hasMessages.rows[0].exists) {
    throw httpErrors.conflict(
      "Cannot delete tag: tag or its descendants have messages attached",
    );
  }

  // Delete tag and all descendants
  await pool.query(
    `DELETE FROM tags WHERE path <@ $1::ltree AND user_id = $2`,
    [tagPath, userId],
  );

  return { id: tagId };
}
