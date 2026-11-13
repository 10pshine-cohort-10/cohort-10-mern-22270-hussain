import { readFile } from "node:fs/promises";
import { pool } from "./db.js";
try {
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  for (const statement of sql.split(";").filter((s) => s.trim()))
    await pool.query(statement);
  console.log("Database schema ready.");
} finally {
  await pool.end();
}
