import crypto from "crypto";

const token = crypto.randomUUID();
const tokenPath = process.env.DUCKDB_PATH?.replace("close_circle.duckdb", ".password-reset-token") || "/data/.password-reset-token";

const fs = await import("fs");
fs.writeFileSync(tokenPath, token);
console.log("Token created. Save this value:");
console.log(token);
console.log("");
console.log("Then use it at: POST /api/auth/reset-password");
console.log("Or delete the token file after use: rm " + tokenPath);
