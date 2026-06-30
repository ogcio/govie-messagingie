import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTag,
  deleteTag,
  getTagById,
  getTagTree,
  listTags,
  updateTag,
} from "../../../services/tags/tag-service.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../../build-testcontainer-pg.js";

let pool: Pool;
const userId = "tag-user-01";
const otherUserId = "tag-user-02";

beforeAll(() => {
  pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

/** Remove all tags and unlink messages for the test users between tests. */
async function cleanup() {
  await pool.query(
    `UPDATE messages SET tag_id = NULL WHERE tag_id IS NOT NULL`,
  );
  await pool.query(`DELETE FROM tags WHERE user_id IN ($1, $2)`, [
    userId,
    otherUserId,
  ]);
}

beforeEach(async () => {
  await cleanup();
});

// ─── createTag ───────────────────────────────────────────────────────────────

describe("createTag", () => {
  it("creates a root tag", async () => {
    const result = await createTag(pool, userId, { label: "Work" });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("string");

    const tag = await getTagById(pool, userId, result.id);
    expect(tag.label).toBe("Work");
    expect(tag.parentTagId).toBeNull();
  });

  it("creates a child tag under an existing parent", async () => {
    const parent = await createTag(pool, userId, { label: "Work" });
    const child = await createTag(pool, userId, {
      label: "Projects",
      parentTagId: parent.id,
    });

    const childTag = await getTagById(pool, userId, child.id);
    expect(childTag.parentTagId).toBe(parent.id);
    expect(childTag.path).toContain(".");
  });

  it("throws 400 when parent tag does not exist", async () => {
    await expect(
      createTag(pool, userId, {
        label: "Orphan",
        parentTagId: randomUUID(),
      }),
    ).rejects.toThrow(/Parent tag not found/);
  });

  it("throws 409 on sibling-name duplicate", async () => {
    await createTag(pool, userId, { label: "Duplicate" });
    await expect(
      createTag(pool, userId, { label: "Duplicate" }),
    ).rejects.toThrow(/already exists under the same parent/);
  });

  it("throws 400 when parent tag belongs to another user", async () => {
    const otherParent = await createTag(pool, otherUserId, {
      label: "OtherParent",
    });
    await expect(
      createTag(pool, userId, {
        label: "Child",
        parentTagId: otherParent.id,
      }),
    ).rejects.toThrow(/Parent tag not found/);
  });
});

// ─── getTagById ──────────────────────────────────────────────────────────────

describe("getTagById", () => {
  it("returns the tag when it exists", async () => {
    const created = await createTag(pool, userId, { label: "Inbox" });
    const tag = await getTagById(pool, userId, created.id);

    expect(tag.id).toBe(created.id);
    expect(tag.label).toBe("Inbox");
    expect(tag.userId).toBe(userId);
  });

  it("throws 404 for a non-existent tag", async () => {
    await expect(getTagById(pool, userId, randomUUID())).rejects.toThrow(
      /Tag not found/,
    );
  });

  it("throws 404 when tag belongs to another user", async () => {
    const created = await createTag(pool, otherUserId, { label: "Secret" });
    await expect(getTagById(pool, userId, created.id)).rejects.toThrow(
      /Tag not found/,
    );
  });
});

// ─── updateTag ───────────────────────────────────────────────────────────────

describe("updateTag", () => {
  it("renames a tag without changing parent", async () => {
    const created = await createTag(pool, userId, { label: "Old" });
    await updateTag(pool, userId, created.id, { label: "New" });

    const tag = await getTagById(pool, userId, created.id);
    expect(tag.label).toBe("New");
  });

  it("moves a tag to a new parent", async () => {
    const parent1 = await createTag(pool, userId, { label: "Parent1" });
    const parent2 = await createTag(pool, userId, { label: "Parent2" });
    const child = await createTag(pool, userId, {
      label: "Child",
      parentTagId: parent1.id,
    });

    await updateTag(pool, userId, child.id, { parentTagId: parent2.id });

    const updated = await getTagById(pool, userId, child.id);
    expect(updated.parentTagId).toBe(parent2.id);
  });

  it("moves a child tag to root", async () => {
    const parent = await createTag(pool, userId, { label: "Parent" });
    const child = await createTag(pool, userId, {
      label: "Child",
      parentTagId: parent.id,
    });

    await updateTag(pool, userId, child.id, { parentTagId: null });

    const updated = await getTagById(pool, userId, child.id);
    expect(updated.parentTagId).toBeNull();
  });

  it("throws 400 when setting self as parent", async () => {
    const tag = await createTag(pool, userId, { label: "Self" });
    await expect(
      updateTag(pool, userId, tag.id, { parentTagId: tag.id }),
    ).rejects.toThrow(/cannot be its own parent/);
  });

  it("throws 400 for circular parent reference", async () => {
    const parent = await createTag(pool, userId, { label: "A" });
    const child = await createTag(pool, userId, {
      label: "B",
      parentTagId: parent.id,
    });

    await expect(
      updateTag(pool, userId, parent.id, { parentTagId: child.id }),
    ).rejects.toThrow(/descendants/);
  });

  it("throws 409 on sibling-name collision after move", async () => {
    const parent = await createTag(pool, userId, { label: "Folder" });
    await createTag(pool, userId, {
      label: "Same",
      parentTagId: parent.id,
    });
    const other = await createTag(pool, userId, { label: "Same" });

    // Move 'other' (root-level "Same") under parent where "Same" already exists
    await expect(
      updateTag(pool, userId, other.id, { parentTagId: parent.id }),
    ).rejects.toThrow(/already exists under the same parent/);
  });

  it("throws 409 on label rename that collides with sibling", async () => {
    const parent = await createTag(pool, userId, { label: "Folder" });
    await createTag(pool, userId, {
      label: "Existing",
      parentTagId: parent.id,
    });
    const target = await createTag(pool, userId, {
      label: "Other",
      parentTagId: parent.id,
    });

    await expect(
      updateTag(pool, userId, target.id, { label: "Existing" }),
    ).rejects.toThrow(/already exists under the same parent/);
  });

  it("throws 404 when moving to a non-existent parent", async () => {
    const tag = await createTag(pool, userId, { label: "Lonely" });
    await expect(
      updateTag(pool, userId, tag.id, { parentTagId: randomUUID() }),
    ).rejects.toThrow(/Tag not found/);
  });

  it("updates descendant paths after move", async () => {
    const parent1 = await createTag(pool, userId, { label: "P1" });
    const parent2 = await createTag(pool, userId, { label: "P2" });
    const child = await createTag(pool, userId, {
      label: "Child",
      parentTagId: parent1.id,
    });
    const grandchild = await createTag(pool, userId, {
      label: "Grandchild",
      parentTagId: child.id,
    });

    // Move child (and grandchild) under parent2
    await updateTag(pool, userId, child.id, { parentTagId: parent2.id });

    const updatedChild = await getTagById(pool, userId, child.id);
    const updatedGrandchild = await getTagById(pool, userId, grandchild.id);
    const parent2Tag = await getTagById(pool, userId, parent2.id);

    // child path should start with parent2's path
    expect(updatedChild.path.startsWith(parent2Tag.path)).toBe(true);
    // grandchild path should start with the updated child path
    expect(updatedGrandchild.path.startsWith(updatedChild.path)).toBe(true);
  });
});

// ─── listTags ────────────────────────────────────────────────────────────────

describe("listTags", () => {
  it("returns all user tags sorted by label", async () => {
    await createTag(pool, userId, { label: "Zebra" });
    await createTag(pool, userId, { label: "Apple" });
    await createTag(pool, userId, { label: "Mango" });

    const tags = await listTags(pool, userId);
    expect(tags).toHaveLength(3);
    expect(tags.map((t) => t.label)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("returns empty array for user with no tags", async () => {
    const tags = await listTags(pool, "nonexistent-user");
    expect(tags).toEqual([]);
  });
});

// ─── getTagTree ──────────────────────────────────────────────────────────────

describe("getTagTree", () => {
  it("builds correct tree structure", async () => {
    const root = await createTag(pool, userId, { label: "Root" });
    const child = await createTag(pool, userId, {
      label: "Child",
      parentTagId: root.id,
    });
    await createTag(pool, userId, {
      label: "Grandchild",
      parentTagId: child.id,
    });

    const tree = await getTagTree(pool, userId);
    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe("Root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].label).toBe("Child");
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].label).toBe("Grandchild");
  });

  it("sorts children alphabetically at each level", async () => {
    const root = await createTag(pool, userId, { label: "Root" });
    await createTag(pool, userId, {
      label: "Zulu",
      parentTagId: root.id,
    });
    await createTag(pool, userId, {
      label: "Alpha",
      parentTagId: root.id,
    });

    const tree = await getTagTree(pool, userId);
    expect(tree[0].children[0].label).toBe("Alpha");
    expect(tree[0].children[1].label).toBe("Zulu");
  });

  it("returns empty tree for user with no tags", async () => {
    const tree = await getTagTree(pool, "nonexistent-user");
    expect(tree).toEqual([]);
  });

  it("returns correct unreadMessages count", async () => {
    const tag = await createTag(pool, userId, { label: "Counted" });

    // Insert two unseen messages linked to the tag
    await pool.query(
      `INSERT INTO messages(user_id, subject, excerpt, plain_text, rich_text, security_level, lang, preferred_transports, thread_name, organisation_id, scheduled_at, is_delivered, is_seen, tag_id)
       VALUES($1, 's', 'e', 'pt', 'rt', 'public', 'en', '{""}', 'tn', 'org1', now(), true, false, $2)`,
      [userId, tag.id],
    );
    await pool.query(
      `INSERT INTO messages(user_id, subject, excerpt, plain_text, rich_text, security_level, lang, preferred_transports, thread_name, organisation_id, scheduled_at, is_delivered, is_seen, tag_id)
       VALUES($1, 's2', 'e2', 'pt2', 'rt2', 'public', 'en', '{""}', 'tn2', 'org1', now(), true, false, $2)`,
      [userId, tag.id],
    );

    const tree = await getTagTree(pool, userId);
    const node = tree.find((n) => n.id === tag.id);
    expect(node).toBeDefined();
    expect(node?.unreadMessages).toBe(2);

    // Cleanup
    await pool.query(`UPDATE messages SET tag_id = NULL WHERE tag_id = $1`, [
      tag.id,
    ]);
  });
});

// ─── deleteTag ───────────────────────────────────────────────────────────────

describe("deleteTag", () => {
  it("deletes a tag successfully", async () => {
    const created = await createTag(pool, userId, { label: "Temp" });
    const result = await deleteTag(pool, userId, created.id);
    expect(result.id).toBe(created.id);

    await expect(getTagById(pool, userId, created.id)).rejects.toThrow(
      /Tag not found/,
    );
  });

  it("deletes tag and all descendants", async () => {
    const root = await createTag(pool, userId, { label: "Root" });
    const child = await createTag(pool, userId, {
      label: "Child",
      parentTagId: root.id,
    });
    await createTag(pool, userId, {
      label: "Grandchild",
      parentTagId: child.id,
    });

    await deleteTag(pool, userId, root.id);

    const remaining = await listTags(pool, userId);
    expect(remaining).toHaveLength(0);
  });

  it("reassigns attached messages to the inbox and deletes the tag", async () => {
    const tag = await createTag(pool, userId, { label: "HasMsg" });

    // Insert a message and assign the tag
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO messages(user_id, subject, excerpt, plain_text, rich_text, security_level, lang, preferred_transports, thread_name, organisation_id, scheduled_at, is_delivered, is_seen, tag_id)
       VALUES($1, 's', 'e', 'pt', 'rt', 'public', 'en', '{""}', 'tn', 'org1', now(), true, false, $2)
       RETURNING id`,
      [userId, tag.id],
    );
    const messageId = inserted.rows[0].id;

    const result = await deleteTag(pool, userId, tag.id);
    expect(result.id).toBe(tag.id);

    // Tag is gone
    await expect(getTagById(pool, userId, tag.id)).rejects.toThrow(
      /Tag not found/,
    );

    // Message is back in the inbox (untagged)
    const message = await pool.query<{ tag_id: string | null }>(
      `SELECT tag_id FROM messages WHERE id = $1`,
      [messageId],
    );
    expect(message.rows[0].tag_id).toBeNull();
  });

  it("throws 404 for non-existent tag", async () => {
    await expect(deleteTag(pool, userId, randomUUID())).rejects.toThrow(
      /Tag not found/,
    );
  });

  it("reassigns a descendant's messages to the inbox and deletes the subtree", async () => {
    const root = await createTag(pool, userId, { label: "Root" });
    const child = await createTag(pool, userId, {
      label: "Child",
      parentTagId: root.id,
    });

    // Attach message to the child, then delete the root
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO messages(user_id, subject, excerpt, plain_text, rich_text, security_level, lang, preferred_transports, thread_name, organisation_id, scheduled_at, is_delivered, is_seen, tag_id)
       VALUES($1, 's', 'e', 'pt', 'rt', 'public', 'en', '{""}', 'tn', 'org1', now(), true, false, $2)
       RETURNING id`,
      [userId, child.id],
    );
    const messageId = inserted.rows[0].id;

    await deleteTag(pool, userId, root.id);

    // Whole subtree removed
    const remaining = await listTags(pool, userId);
    expect(remaining).toHaveLength(0);

    // Message restored to the inbox (untagged)
    const message = await pool.query<{ tag_id: string | null }>(
      `SELECT tag_id FROM messages WHERE id = $1`,
      [messageId],
    );
    expect(message.rows[0].tag_id).toBeNull();
  });

  it("throws 404 when tag belongs to another user", async () => {
    const otherTag = await createTag(pool, otherUserId, {
      label: "OtherTag",
    });
    await expect(deleteTag(pool, userId, otherTag.id)).rejects.toThrow(
      /Tag not found/,
    );
  });
});
