import { expect } from "chai";
import { randomUUID } from "node:crypto";
import { pool } from "../server/db.js";
import { createRepository } from "../server/repository.js";
describe("MySQL integration (requires migrated test database)", () => {
  const repo = createRepository(pool),
    uid = randomUUID(),
    other = randomUUID();
  after(async () => {
    await pool.execute("DELETE FROM users WHERE id=?", [uid]);
    await pool.end();
  });
  it("persists, isolates, updates and deletes real notes", async () => {
    await repo.createUser({
      id: uid,
      name: "Integration",
      email: uid + "@example.com",
      password_hash: "test-only",
    });
    const n = await repo.createNote(uid, {
      id: randomUUID(),
      title: "Original",
      content: "<p>Content</p>",
      color: "mint",
      pinned: false,
    });
    expect(n.title).eq("Original");
    expect(await repo.note(other, n.id)).eq(undefined);
    expect(await repo.deleteNote(other, n.id)).eq(0);
    await repo.updateNote(uid, n.id, {
      title: "Updated",
      content: "<p>Saved</p>",
      color: "cream",
      pinned: true,
    });
    expect((await repo.note(uid, n.id)).title).eq("Updated");
    await repo.importNotes(uid, [
      {
        id: randomUUID(),
        title: "Imported",
        content: "",
        color: "peach",
        pinned: false,
      },
    ]);
    expect(await repo.list(uid)).length(2);
    expect(await repo.deleteNote(uid, n.id)).eq(1);
  });
});
