import { 
  type User, 
  type InsertUser, 
  type Resume, 
  type InsertResume,
  type Analysis,
  type InsertAnalysis,
  users,
  resumes,
  analyses
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, desc } from "drizzle-orm";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getResume(id: string): Promise<Resume | undefined>;
  getResumesByUserId(userId: string): Promise<Resume[]>;
  createResume(resume: InsertResume): Promise<Resume>;
  
  getAnalysis(id: string): Promise<Analysis | undefined>;
  getAnalysisByResumeId(resumeId: string): Promise<Analysis | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private resumes: Map<string, Resume>;
  private analyses: Map<string, Analysis>;

  constructor() {
    this.users = new Map();
    this.resumes = new Map();
    this.analyses = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getResume(id: string): Promise<Resume | undefined> {
    return this.resumes.get(id);
  }

  async getResumesByUserId(userId: string): Promise<Resume[]> {
    return Array.from(this.resumes.values())
      .filter((resume) => resume.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createResume(insertResume: InsertResume): Promise<Resume> {
    const id = randomUUID();
    const resume: Resume = { 
      ...insertResume, 
      id,
      createdAt: new Date()
    };
    this.resumes.set(id, resume);
    return resume;
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async getAnalysisByResumeId(resumeId: string): Promise<Analysis | undefined> {
    return Array.from(this.analyses.values()).find(
      (analysis) => analysis.resumeId === resumeId
    );
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = randomUUID();
    const analysis: Analysis = { 
      id,
      resumeId: insertAnalysis.resumeId,
      completenessScore: insertAnalysis.completenessScore,
      completenessRationale: insertAnalysis.completenessRationale,
      sectionScores: insertAnalysis.sectionScores,
      suggestions: insertAnalysis.suggestions,
      createdAt: new Date()
    };
    this.analyses.set(id, analysis);
    return analysis;
  }
}

export class DbStorage implements IStorage {
  private db;

  constructor(connectionString: string) {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString });
    this.db = drizzle(pool);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getResume(id: string): Promise<Resume | undefined> {
    const result = await this.db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
    return result[0];
  }

  async getResumesByUserId(userId: string): Promise<Resume[]> {
    return await this.db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .orderBy(desc(resumes.createdAt));
  }

  async createResume(insertResume: InsertResume): Promise<Resume> {
    const result = await this.db.insert(resumes).values(insertResume).returning();
    return result[0];
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    const result = await this.db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
    return result[0];
  }

  async getAnalysisByResumeId(resumeId: string): Promise<Analysis | undefined> {
    const result = await this.db.select().from(analyses).where(eq(analyses.resumeId, resumeId)).limit(1);
    return result[0];
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const result = await this.db.insert(analyses).values(insertAnalysis).returning();
    return result[0];
  }
}

const dbUrl = process.env.DATABASE_URL;
export const storage = dbUrl ? new DbStorage(dbUrl) : new MemStorage();
