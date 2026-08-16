import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Builds a Drizzle client for a single app. Pass only the schemas that app
 * needs, e.g. `createDb({ ...auth })`.
 */
export function createDb<TSchema extends Record<string, unknown>>(
  schema: TSchema,
  connectionString = process.env.DATABASE_URL,
) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return drizzle(new Pool({ connectionString }), { schema });
}
