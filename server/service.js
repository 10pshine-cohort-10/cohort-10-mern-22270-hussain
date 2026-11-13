import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import sanitize from "sanitize-html";
import { z } from "zod";
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z
    .string()
    .min(10)
    .max(72)
    .refine(
      (s) => Buffer.byteLength(s, "utf8") <= 72,
      "Password must fit within 72 UTF-8 bytes.",
    ),
});
const registration = credentials.extend({
  name: z.string().trim().min(1).max(80),
});
export const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(200000),
  color: z.enum(["cream", "lavender", "mint", "peach"]).default("cream"),
  pinned: z.boolean().default(false),
});
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });
export const cleanNote = (input) => ({
  ...noteSchema.parse(input),
  content: sanitize(input.content, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "s",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "blockquote",
      "pre",
      "code",
      "hr",
    ],
    allowedAttributes: {},
  }),
});
export function createService(repo) {
  return {
    async register(input) {
      const d = registration.parse(input);
      const hash = await bcrypt.hash(d.password, 12);
      try {
        return await repo.createUser({
          id: randomUUID(),
          name: d.name,
          email: d.email,
          password_hash: hash,
          session_version: 0,
        });
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY")
          throw new AppError(409, "An account with this email already exists.");
        throw e;
      }
    },
    async login(input) {
      const d = credentials.parse(input),
        u = await repo.userByEmail(d.email);
      if (!u || !(await bcrypt.compare(d.password, u.password_hash)))
        throw new AppError(401, "Email or password is incorrect.");
      return u;
    },
    async save(uid, id, input) {
      const d = cleanNote(input);
      if (id) {
        if (!(await repo.note(uid, id)))
          throw new AppError(404, "Note not found.");
        return repo.updateNote(uid, id, d);
      }
      return repo.createNote(uid, { ...d, id: randomUUID() });
    },
    async remove(uid, id) {
      if (!(await repo.deleteNote(uid, id)))
        throw new AppError(404, "Note not found.");
    },
    async import(uid, input) {
      const d = z.object({ notes: z.array(noteSchema).max(500) }).parse(input);
      await repo.importNotes(
        uid,
        d.notes.map((n) => ({ ...cleanNote(n), id: randomUUID() })),
      );
      return d.notes.length;
    },
  };
}
