import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
});

export const resumes = pgTable("resumes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  filesize: integer("filesize").notNull(),
  mimeType: text("mime_type").notNull(),
  extractedText: text("extracted_text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id").notNull().references(() => resumes.id),
  completenessScore: integer("completeness_score").notNull(),
  completenessRationale: text("completeness_rationale").notNull(),
  sectionScores: jsonb("section_scores").notNull().$type<{
    summary: number;
    education: number;
    experience: number;
    other: number;
  }>(),
  suggestions: jsonb("suggestions").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertResumeSchema = createInsertSchema(resumes).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertResume = z.infer<typeof insertResumeSchema>;
export type Resume = typeof resumes.$inferSelect;

export const insertAnalysisSchema = createInsertSchema(analyses).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export const jobMatches = pgTable("job_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id").notNull().references(() => resumes.id),
  jobDescription: text("job_description").notNull(),
  jobRole: text("job_role"),
  jobLocation: text("job_location"),
  alignmentScore: integer("alignment_score").notNull(),
  alignmentRationale: text("alignment_rationale").notNull(),
  gaps: jsonb("gaps").notNull().$type<Array<{
    category: string;
    description: string;
    severity: "high" | "medium" | "low";
  }>>(),
  strengths: jsonb("strengths").notNull().$type<string[]>(),
  recommendations: jsonb("recommendations").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertJobMatchSchema = createInsertSchema(jobMatches).omit({
  id: true,
  createdAt: true,
});
export type InsertJobMatch = z.infer<typeof insertJobMatchSchema>;
export type JobMatch = typeof jobMatches.$inferSelect;
