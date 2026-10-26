import { Hono } from "hono";
import { createDb } from "../db.js";
import type { AppContext } from "../auth.js";
import fs from "fs";
import path from "path";

export const photosRouter = new Hono<AppContext>();

const PHOTOS_DIR = "/data/photos";

// Transparent 1x1 pixel PNG (used as fallback when no photo exists)
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function ensurePhotoDir(): void {
  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  }
}

// POST /api/contacts/:id/photo — Upload or replace a photo (base64 in JSON body)
photosRouter.post("/:id/photo", async (c) => {
  const userId = c.get("userId");
  const contactId = c.req.param("id");
  const db = createDb();

  // Verify ownership
  const existing = await db.queryOne<{ id: string }>(
    "SELECT id FROM contacts WHERE id = ? AND user_id = ?",
    [contactId, userId]
  );
  if (!existing) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({})) as { photo_data: string };
  const photoData = body.photo_data;
  if (!photoData || !photoData.startsWith("data:image")) {
    return c.json({ error: "Invalid photo data" }, 400);
  }

  ensurePhotoDir();

  // Extract base64 data
  const base64Data = photoData.split(";base64,").pop() ?? photoData.split(",").pop() ?? "";
  const buffer = Buffer.from(base64Data, "base64");

  // Generate filename: {contactId}.jpg
  const filename = `${contactId}.jpg`;
  const filePath = path.join(PHOTOS_DIR, filename);

  // Delete old photo if exists
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Write new photo
  fs.writeFileSync(filePath, buffer);

  // Update database
  await db.execute("UPDATE contacts SET photo_path = ? WHERE id = ?", [filename, contactId]);

  return c.json({ data: { photo_path: filename } }, 201);
});

// GET /api/contacts/:id/photo — Return photo file (or placeholder if none)
// Works with or without auth: authenticated requests check visibility;
// unauthenticated requests only serve photos for non-private contacts.
photosRouter.get("/:id/photo", async (c) => {
  const contactId = c.req.param("id");
  const userId = c.get("userId") as string | undefined;
  const db = createDb();

  if (userId) {
    // Authenticated: check full visibility (shared or owned)
    const visSql = `(is_private = false OR user_id = ?)`;
    const contact = await db.queryOne<{ id: string; photo_path: string }>(
      `SELECT id, photo_path FROM contacts WHERE id = ? AND ${visSql}`,
      [contactId, userId]
    );

    if (!contact || !contact.photo_path) {
      return c.body(PLACEHOLDER_PNG, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const filePath = path.join(PHOTOS_DIR, contact.photo_path);
    if (!fs.existsSync(filePath)) {
      await db.execute("UPDATE contacts SET photo_path = NULL WHERE id = ?", [contactId]);
      return c.body(PLACEHOLDER_PNG, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const buffer = fs.readFileSync(filePath);
    return c.body(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } else {
    // Unauthenticated: only serve photos for shared (non-private) contacts
    const contact = await db.queryOne<{ id: string; photo_path: string }>(
      `SELECT id, photo_path FROM contacts WHERE id = ? AND is_private = false`,
      [contactId]
    );

    if (!contact || !contact.photo_path) {
      return c.body(PLACEHOLDER_PNG, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const filePath = path.join(PHOTOS_DIR, contact.photo_path);
    if (!fs.existsSync(filePath)) {
      return c.body(PLACEHOLDER_PNG, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const buffer = fs.readFileSync(filePath);
    return c.body(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
});

// DELETE /api/contacts/:id/photo — Remove photo
photosRouter.delete("/:id/photo", async (c) => {
  const userId = c.get("userId");
  const contactId = c.req.param("id");
  const db = createDb();

  const existing = await db.queryOne<{ id: string; photo_path: string }>(
    "SELECT id, photo_path FROM contacts WHERE id = ? AND user_id = ?",
    [contactId, userId]
  );
  if (!existing) {
    return c.json({ error: "Contact not found" }, 404);
  }

  if (existing.photo_path) {
    const filePath = path.join(PHOTOS_DIR, existing.photo_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await db.execute("UPDATE contacts SET photo_path = NULL WHERE id = ?", [contactId]);
  }

  return c.json({ data: { success: true } });
});
