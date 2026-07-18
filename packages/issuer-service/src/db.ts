import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://zkmcp:zkmcp@localhost:5432/zkmcp",
});
