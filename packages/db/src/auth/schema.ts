import { boolean, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const authSchema = pgSchema("auth");

/**
 * Shared identity table. Every app's schema references this, so it stays
 * minimal — session/account/verification tables belong to whichever auth
 * library ends up owning them.
 */
export const users = authSchema.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
