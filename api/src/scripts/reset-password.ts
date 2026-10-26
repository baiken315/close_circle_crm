import bcrypt from "bcryptjs";
import { Database as DuckDB } from "duckdb-async";

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Usage: npm run reset-password <new-password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const dbPath = process.env.DUCKDB_PATH || "/data/close_circle.duckdb";

  const duckdb = await DuckDB.create(dbPath);
  const conn = await duckdb.connect();

  try {
    const result = await conn.all("SELECT id, email FROM users LIMIT 1");
    const rows = result as Array<Record<string, string>>;
    const user = rows[0];

    if (!user) {
      console.error("No users found in database");
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);

    await conn.run(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [hash, user.id]
    );

    console.log("Password updated for " + user.email + " (" + user.id + ")");
  } finally {
    await conn.close();
    await duckdb.close();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
