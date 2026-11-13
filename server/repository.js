export function createRepository(db) {
  const one = async (sql, args) => (await db.execute(sql, args))[0][0];
  return {
    userByEmail: (email) => one("SELECT * FROM users WHERE email=?", [email]),
    userById: (id) => one("SELECT * FROM users WHERE id=?", [id]),
    async createUser(u) {
      await db.execute(
        "INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,?)",
        [u.id, u.name, u.email, u.password_hash],
      );
      return u;
    },
    revoke: (id) =>
      db.execute(
        "UPDATE users SET session_version=session_version+1 WHERE id=?",
        [id],
      ),
    async list(uid) {
      return (
        await db.execute(
          "SELECT * FROM notes WHERE user_id=? ORDER BY pinned DESC,updated_at DESC",
          [uid],
        )
      )[0];
    },
    note: (uid, id) =>
      one("SELECT * FROM notes WHERE user_id=? AND id=?", [uid, id]),
    async createNote(uid, n) {
      await db.execute(
        "INSERT INTO notes (id,user_id,title,content,color,pinned) VALUES (?,?,?,?,?,?)",
        [n.id, uid, n.title, n.content, n.color, n.pinned],
      );
      return this.note(uid, n.id);
    },
    async updateNote(uid, id, n) {
      await db.execute(
        "UPDATE notes SET title=?,content=?,color=?,pinned=?,updated_at=CURRENT_TIMESTAMP(3) WHERE user_id=? AND id=?",
        [n.title, n.content, n.color, n.pinned, uid, id],
      );
      return this.note(uid, id);
    },
    async deleteNote(uid, id) {
      return (
        await db.execute("DELETE FROM notes WHERE user_id=? AND id=?", [
          uid,
          id,
        ])
      )[0].affectedRows;
    },
    async importNotes(uid, notes) {
      const c = await db.getConnection();
      try {
        await c.beginTransaction();
        const r = createRepository(c);
        for (const n of notes) await r.createNote(uid, n);
        await c.commit();
      } catch (e) {
        await c.rollback();
        throw e;
      } finally {
        c.release();
      }
    },
  };
}
