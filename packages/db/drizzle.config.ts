import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/*/schema.ts",
  out: "./drizzle",
  // Every app schema must be listed here, otherwise drizzle-kit treats its
  // tables as unmanaged and generates drops for them.
  schemaFilter: ["auth", "job_finder"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
