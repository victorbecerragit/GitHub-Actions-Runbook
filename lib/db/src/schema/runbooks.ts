import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const runbooksTable = pgTable("runbooks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  system: text("system").notNull(),
  severity: text("severity").notNull().$type<"low" | "medium" | "high" | "critical">(),
  steps: text("steps").notNull().default(""),
  rollback: text("rollback").notNull().default(""),
  tags: text("tags").notNull().default("[]"), // stored as JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRunbookSchema = createInsertSchema(runbooksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRunbookSchema = insertRunbookSchema.partial();

export type InsertRunbook = z.infer<typeof insertRunbookSchema>;
export type Runbook = typeof runbooksTable.$inferSelect;
