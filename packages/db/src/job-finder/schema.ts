import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "../auth/schema.js";

export const jobFinderSchema = pgSchema("job_finder");

export const savedJobs = jobFinderSchema.table("saved_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
