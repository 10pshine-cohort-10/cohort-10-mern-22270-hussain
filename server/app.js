import express from "express";
import { randomUUID } from "node:crypto";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { createService, AppError, publicUser } from "./service.js";
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: [
    "req.headers.cookie",
    "req.headers.authorization",
    'res.headers["set-cookie"]',
    "password",
    "token",
    "err.sql",
    "err.sqlMessage",
  ],
});
export function createApp({
  repo,
  secret,
  origin,
  production = false,
  emit = () => {},
}) {
  const app = express(),
    service = createService(repo);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));
  app.use(express.json({ limit: "12mb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== origin
    )
      return next(new AppError(403, "Request origin is not allowed."));
    next();
  });
  const cookie = {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    path: "/",
    maxAge: 604800000,
  };
  const session = async (req, res, next) => {
    let data;
    try {
      data = jwt.verify(req.cookies.session, secret, { algorithms: ["HS256"] });
    } catch {
      return next(new AppError(401, "Please log in to continue."));
    }
    try {
      const u = await repo.userById(data.sub);
      if (!u || u.session_version !== data.v)
        return next(new AppError(401, "Please log in to continue."));
      req.user = u;
      next();
    } catch (e) {
      next(e);
    }
  };
  const limit = rateLimit({
    windowMs: 900000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
  const auth = (method) => async (req, res) => {
    const u = await service[method](req.body);
    res.cookie(
      "session",
      jwt.sign({ v: u.session_version }, secret, {
        subject: u.id,
        expiresIn: "7d",
        algorithm: "HS256",
      }),
      cookie,
    );
    logger.info({ userId: u.id, event: method }, "User authenticated");
    res.status(method === "register" ? 201 : 200).json({ user: publicUser(u) });
  };
  app.get("/api/health", async (req, res) => {
    await repo.list("__health__");
    res.json({ status: "ok" });
  });
  app.post("/api/auth/register", limit, auth("register"));
  app.post("/api/auth/login", limit, auth("login"));
  app.get("/api/auth/me", session, (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  app.post("/api/auth/logout", session, async (req, res) => {
    await repo.revoke(req.user.id);
    emit(req.user.id, "session:revoked");
    res.clearCookie("session", {
      httpOnly: true,
      sameSite: "strict",
      secure: production,
      path: "/",
    });
    logger.info({ userId: req.user.id, event: "logout" }, "User logged out");
    res.sendStatus(204);
  });
  app.use("/api/notes", session);
  app.get("/api/notes", async (req, res) =>
    res.json({ notes: await repo.list(req.user.id) }),
  );
  app.get("/api/notes/export", async (req, res) => {
    const notes = await repo.list(req.user.id);
    res
      .attachment("folio-notes.json")
      .json({
        version: 1,
        notes: notes.map(({ title, content, color, pinned }) => ({
          title,
          content,
          color,
          pinned: Boolean(pinned),
        })),
      });
  });
  app.post("/api/notes/import", async (req, res) => {
    const count = await service.import(req.user.id, req.body);
    emit(req.user.id);
    logger.info(
      { userId: req.user.id, count, event: "import" },
      "Notes imported",
    );
    res.status(201).json({ count });
  });
  app.get("/api/notes/:id", async (req, res) => {
    const note = await repo.note(req.user.id, req.params.id);
    if (!note) throw new AppError(404, "Note not found.");
    res.json({ note });
  });
  const save = async (req, res) => {
    const note = await service.save(req.user.id, req.params.id, req.body);
    emit(req.user.id);
    logger.info(
      {
        userId: req.user.id,
        noteId: note.id,
        event: req.params.id ? "update" : "create",
      },
      "Note saved",
    );
    res.status(req.params.id ? 200 : 201).json({ note });
  };
  app.post("/api/notes", save);
  app.put("/api/notes/:id", save);
  app.delete("/api/notes/:id", async (req, res) => {
    await service.remove(req.user.id, req.params.id);
    emit(req.user.id);
    logger.info(
      { userId: req.user.id, noteId: req.params.id, event: "delete" },
      "Note deleted",
    );
    res.sendStatus(204);
  });
  app.use("/api", (req, res, next) =>
    next(new AppError(404, "Endpoint not found.")),
  );
  app.use((err, req, res, next) => {
    req.log.error({ err }, "Request failed");
    const status = err instanceof ZodError ? 400 : err.status || 500;
    res
      .status(status)
      .json({
        error:
          err instanceof ZodError
            ? err.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : status >= 500
              ? "Something went wrong. Please try again."
              : err.message,
        requestId: req.id,
      });
  });
  return app;
}
