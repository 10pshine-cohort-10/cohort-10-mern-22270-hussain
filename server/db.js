import "dotenv/config";
import mysql from "mysql2/promise";
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "notes",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "notes",
  connectionLimit: 10,
  timezone: "Z",
  dateStrings: true,
});
// DATETIME fields have no timezone; store every timestamp in UTC.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) connection.destroy();
  });
});
