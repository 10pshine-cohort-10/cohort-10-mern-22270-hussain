import "dotenv/config";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import express from "express";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { pool } from "./db.js";
import { createRepository } from "./repository.js";
import { createApp, logger } from "./app.js";
const secret = process.env.JWT_SECRET,
  origin = process.env.APP_ORIGIN || "http://127.0.0.1:5173";
if (!secret || secret.length < 32 || secret.startsWith("replace-"))
  throw new Error("Set JWT_SECRET to at least 32 random characters.");
const repo = createRepository(pool);
let io;
const app = createApp({
  repo,
  secret,
  origin,
  production: process.env.NODE_ENV === "production",
  emit: (uid, event = "notes:changed") => {
    io?.to(uid).emit(event);
    if (event === "session:revoked") io?.in(uid).disconnectSockets(true);
  },
});
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
app.use(express.static(dist));
app.get("/{*path}", (req, res) => res.sendFile(dist + "index.html"));
const server = createServer(app);
io = new Server(server, {
  allowRequest: (req, cb) => cb(null, req.headers.origin === origin),
});
io.use(async (socket, next) => {
  try {
    const cookies = Object.fromEntries(
      (socket.request.headers.cookie || "")
        .split(";")
        .filter(Boolean)
        .map((c) => {
          const i = c.indexOf("=");
          return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
        }),
    );
    const data = jwt.verify(cookies.session, secret, { algorithms: ["HS256"] });
    const u = await repo.userById(data.sub);
    if (!u || u.session_version !== data.v) throw new Error();
    socket.data.uid = u.id;
    socket.data.exp = data.exp;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
io.on("connection", (s) => {
  s.join(s.data.uid);
  const timer = setTimeout(
    () => s.disconnect(true),
    Math.max(0, s.data.exp * 1000 - Date.now()),
  );
  s.on("disconnect", () => clearTimeout(timer));
});
server.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  logger.info({ port: process.env.PORT || 3001 }, "Folio ready"),
);
let closing = false;
async function shutdown(code) {
  if (closing) return;
  closing = true;
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  io.close();
  server.close();
  await pool.end();
  process.exit(code);
}
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "Unhandled rejection");
  shutdown(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  shutdown(1);
});
