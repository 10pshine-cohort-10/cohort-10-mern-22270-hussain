// Opt-in end-to-end check against a running local server and its MySQL database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";
import { pool } from "../server/db.js";
const base = process.env.API_BASE || "http://127.0.0.1:3001";
const origin = process.env.APP_ORIGIN || "http://127.0.0.1:5173";
const ids = [],
  sockets = [];
async function call(path, method = "GET", body, cookie) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json();
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function account() {
  const r = await call("/auth/register", "POST", {
    name: "Disposable smoke test",
    email: randomUUID() + "@example.test",
    password: randomUUID(),
  });
  assert.equal(r.status, 201);
  ids.push(r.data.user.id);
  return r.cookie;
}
function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for " + name)),
      5000,
    );
    socket.once(name, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}
async function connect(cookie) {
  const s = io(base, {
    autoConnect: false,
    transports: ["websocket"],
    extraHeaders: { Origin: origin, Cookie: cookie },
    reconnection: false,
  });
  sockets.push(s);
  const ready = event(s, "connect");
  s.connect();
  await ready;
  return s;
}
try {
  const a = await account(),
    b = await account();
  const own = await connect(a),
    other = await connect(b);
  let otherEvents = 0;
  other.on("notes:changed", () => otherEvents++);
  const changed = event(own, "notes:changed");
  const created = await call(
    "/notes",
    "POST",
    {
      title: "Smoke rich note",
      content: "<h2>Heading</h2><p><strong>Bold</strong></p>",
      color: "lavender",
      pinned: true,
    },
    a,
  );
  assert.equal(created.status, 201);
  await changed;
  const id = created.data.note.id;
  assert.equal((await call("/notes/" + id, "GET", undefined, b)).status, 404);
  const exported = await call("/notes/export", "GET", undefined, a);
  assert.equal(exported.data.notes.length, 1);
  assert.ok(exported.data.notes[0].content.includes("<strong>Bold</strong>"));
  assert.equal(
    (await call("/notes/import", "POST", exported.data, a)).data.count,
    1,
  );
  assert.equal(
    (
      await call(
        "/notes/" + id,
        "PUT",
        {
          title: "Edited",
          content: "<p>Updated</p>",
          color: "mint",
          pinned: false,
        },
        a,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/notes/" + id, "DELETE", undefined, a)).status,
    204,
  );
  assert.equal(
    otherEvents,
    0,
    "Another user must not receive private update events",
  );
  const disconnected = event(own, "disconnect");
  assert.equal((await call("/auth/logout", "POST", undefined, a)).status, 204);
  await disconnected;
  assert.equal(
    (await call("/auth/me", "GET", undefined, a)).status,
    401,
    "Logged-out session must be revoked",
  );
  console.log(
    "PASS: live authentication, rich CRUD, owner isolation, import/export, Socket.IO rooms and session revocation.",
  );
} finally {
  for (const s of sockets) s.disconnect();
  for (const id of ids)
    await pool.execute("DELETE FROM users WHERE id=?", [id]);
  await pool.end();
}
