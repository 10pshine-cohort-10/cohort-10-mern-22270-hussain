import { expect } from "chai";
import request from "supertest";
import { createApp } from "../server/app.js";
import { createService, cleanNote } from "../server/service.js";
import { createRepository } from "../server/repository.js";
const origin = "http://127.0.0.1:5173";
function fixture() {
  const users = new Map(),
    notes = new Map();
  const repo = {
    async createUser(u) {
      if ([...users.values()].some((x) => x.email === u.email))
        throw Object.assign(new Error(), { code: "ER_DUP_ENTRY" });
      users.set(u.id, u);
      return u;
    },
    async userByEmail(e) {
      return [...users.values()].find((u) => u.email === e);
    },
    async userById(id) {
      return users.get(id);
    },
    async revoke(id) {
      users.get(id).session_version++;
    },
    async list(uid) {
      return [...notes.values()].filter((n) => n.user_id === uid);
    },
    async note(uid, id) {
      const n = notes.get(id);
      return n?.user_id === uid ? n : undefined;
    },
    async createNote(uid, n) {
      const v = { ...n, user_id: uid };
      notes.set(n.id, v);
      return v;
    },
    async updateNote(uid, id, n) {
      if (await this.note(uid, id)) return this.createNote(uid, { ...n, id });
    },
    async deleteNote(uid, id) {
      if (!(await this.note(uid, id))) return 0;
      notes.delete(id);
      return 1;
    },
    async importNotes(uid, ns) {
      for (const n of ns) await this.createNote(uid, n);
    },
  };
  return {
    repo,
    app: createApp({
      repo,
      origin,
      secret: "a-secret-with-more-than-32-characters",
    }),
  };
}
const signup = (a, email = "test@example.com") =>
  a
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "Alex", email, password: "StrongPassword42" });
describe("authentication and controllers", () => {
  it("registers, logs in, rejects wrong passwords and revokes sessions", async () => {
    const { app } = fixture();
    const a = request.agent(app);
    expect((await signup(a)).status).eq(201);
    expect((await a.get("/api/auth/me")).body.user.email).eq(
      "test@example.com",
    );
    expect((await a.post("/api/auth/logout").set("Origin", origin)).status).eq(
      204,
    );
    expect((await a.get("/api/auth/me")).status).eq(401);
    expect(
      (
        await a
          .post("/api/auth/login")
          .set("Origin", origin)
          .send({ email: "test@example.com", password: "WrongPassword12" })
      ).status,
    ).eq(401);
    expect(
      (
        await a
          .post("/api/auth/login")
          .set("Origin", origin)
          .send({ email: "test@example.com", password: "StrongPassword42" })
      ).status,
    ).eq(200);
  });
  it("isolates owners across reads, updates, deletes and exports", async () => {
    const { app } = fixture();
    const a = request.agent(app),
      b = request.agent(app);
    await signup(a);
    await signup(b, "other@example.com");
    const r = await a
      .post("/api/notes")
      .set("Origin", origin)
      .send({ title: "Private", content: "<p>Hello</p>" });
    expect(r.status).eq(201);
    const id = r.body.note.id;
    expect((await b.get("/api/notes")).body.notes).length(0);
    expect((await b.get("/api/notes/" + id)).status).eq(404);
    expect(
      (
        await b
          .put("/api/notes/" + id)
          .set("Origin", origin)
          .send({ title: "Stolen", content: "" })
      ).status,
    ).eq(404);
    expect(
      (await b.delete("/api/notes/" + id).set("Origin", origin)).status,
    ).eq(404);
    expect((await b.get("/api/notes/export")).body.notes).length(0);
    expect(
      (
        await a
          .put("/api/notes/" + id)
          .set("Origin", origin)
          .send({ title: "Updated", content: "<p>Yes</p>", pinned: true })
      ).body.note.title,
    ).eq("Updated");
    expect(
      (await a.delete("/api/notes/" + id).set("Origin", origin)).status,
    ).eq(204);
  });
  it("validates input, blocks cross-origin writes and sanitizes imports", async () => {
    const { app } = fixture();
    const a = request.agent(app);
    expect((await a.post("/api/auth/register").send({})).status).eq(403);
    await signup(a);
    expect(
      (
        await a
          .post("/api/notes")
          .set("Origin", origin)
          .send({ title: "", content: "" })
      ).status,
    ).eq(400);
    expect(
      (
        await a
          .post("/api/notes/import")
          .set("Origin", origin)
          .send({
            notes: [
              {
                title: "Imported",
                content: '<script>alert(1)</script><p onclick="x()">Safe</p>',
              },
            ],
          })
      ).body.count,
    ).eq(1);
    expect((await a.get("/api/notes/export")).body.notes[0].content).eq(
      "<p>Safe</p>",
    );
  });
  it("hides internal errors", async () => {
    const { app, repo } = fixture();
    repo.list = () => {
      throw new Error("secret database password");
    };
    const r = await request(app).get("/api/health");
    expect(r.status).eq(500);
    expect(r.body.error).not.include("secret");
  });
});
describe("services", () => {
  it("sanitizes rich text and rejects invalid colors", () => {
    expect(
      cleanNote({ title: "Hi", content: "<img src=x onerror=x><p>safe</p>" })
        .content,
    ).eq("<p>safe</p>");
    expect(() =>
      cleanNote({ title: "Hi", content: "", color: "red" }),
    ).to.throw();
  });
  it("rejects duplicate emails", async () => {
    const { repo } = fixture(),
      s = createService(repo),
      u = {
        name: "Alex",
        email: "A@example.com",
        password: "StrongPassword42",
      };
    await s.register(u);
    try {
      await s.register(u);
      throw new Error("Expected conflict");
    } catch (e) {
      expect(e.status).eq(409);
    }
  });
});
describe("data access", () => {
  it("parameterizes owner-scoped operations", async () => {
    const calls = [];
    const r = createRepository({
      execute: async (sql, args) => {
        calls.push({ sql, args });
        return sql.startsWith("DELETE") ? [{ affectedRows: 1 }] : [[]];
      },
    });
    await r.note("owner", "' OR 1=1");
    await r.deleteNote("owner", "id");
    await r.updateNote("owner", "id", {
      title: "T",
      content: "C",
      color: "mint",
      pinned: false,
    });
    for (const c of calls) {
      expect(c.sql).include("user_id=?");
      expect(c.sql).not.include("' OR 1=1");
    }
    expect(calls[0].args).deep.eq(["owner", "' OR 1=1"]);
  });
  it("rolls back failed imports and releases connections", async () => {
    const events = [];
    const c = {
      beginTransaction: async () => events.push("begin"),
      execute: async () => {
        throw new Error("DB failure");
      },
      rollback: async () => events.push("rollback"),
      commit: async () => events.push("commit"),
      release: () => events.push("release"),
    };
    try {
      await createRepository({ getConnection: async () => c }).importNotes(
        "u",
        [{ id: "n", title: "T", content: "", color: "cream", pinned: false }],
      );
    } catch (e) {
      expect(e.message).eq("DB failure");
    }
    expect(events).deep.eq(["begin", "rollback", "release"]);
  });
});
