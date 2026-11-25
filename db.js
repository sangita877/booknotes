import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

db.connect()
  .then((client) => {
    console.log("Database connected successfully!");
    client.release();
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
  });

export default db;