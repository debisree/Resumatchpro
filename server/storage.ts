import { 
  type User, 
  type InsertUser, 
  type Resume, 
  type InsertResume,
  type Analysis,
  type InsertAnalysis,
  type JobMatch,
  type InsertJobMatch,
  users,
  resumes,
  analyses,
  jobMatches
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
  
  getJobMatch(id: string): Promise<JobMatch | undefined>;
  getJobMatchesByResumeId(resumeId: string): Promise<JobMatch[]>;
  createJobMatch(jobMatch: InsertJobMatch): Promise<JobMatch>;
  updateJobMatchResponses(
    id: string,
    gapResponses: Array<{ gapIndex: number; proficiencyLevel: string }>,
    finalVerdict: string,
    shouldApply: boolean
  ): Promise<JobMatch | undefined>;
  updateJobMatchResume(id: string, tailoredResumeContent: string): Promise<JobMatch | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private resumes: Map<string, Resume>;
  private analyses: Map<string, Analysis>;
  private jobMatches: Map<string, JobMatch>;

  constructor() {
    this.users = new Map();
    this.resumes = new Map();
    this.analyses = new Map();
    this.jobMatches = new Map();
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

  async getJobMatch(id: string): Promise<JobMatch | undefined> {
    return this.jobMatches.get(id);
  }

  async getJobMatchesByResumeId(resumeId: string): Promise<JobMatch[]> {
    return Array.from(this.jobMatches.values())
      .filter((match) => match.resumeId === resumeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createJobMatch(insertJobMatch: InsertJobMatch): Promise<JobMatch> {
    const id = randomUUID();
    const jobMatch: JobMatch = {
      id,
      ...insertJobMatch,
      createdAt: new Date()
    };
    this.jobMatches.set(id, jobMatch);
    return jobMatch;
  }

  async updateJobMatchResponses(
    id: string,
    gapResponses: Array<{ gapIndex: number; proficiencyLevel: string }>,
    finalVerdict: string,
    shouldApply: boolean
  ): Promise<JobMatch | undefined> {
    const jobMatch = this.jobMatches.get(id);
    if (!jobMatch) return undefined;

    const updated: JobMatch = {
      ...jobMatch,
      gapResponses: gapResponses as any,
      finalVerdict,
      shouldApply,
    };
    this.jobMatches.set(id, updated);
    return updated;
  }

  async updateJobMatchResume(id: string, tailoredResumeContent: string): Promise<JobMatch | undefined> {
    const jobMatch = this.jobMatches.get(id);
    if (!jobMatch) return undefined;

    const updated: JobMatch = {
      ...jobMatch,
      tailoredResumeContent,
    };
    this.jobMatches.set(id, updated);
    return updated;
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

  async getJobMatch(id: string): Promise<JobMatch | undefined> {
    const result = await this.db.select().from(jobMatches).where(eq(jobMatches.id, id)).limit(1);
    return result[0];
  }

  async getJobMatchesByResumeId(resumeId: string): Promise<JobMatch[]> {
    return await this.db
      .select()
      .from(jobMatches)
      .where(eq(jobMatches.resumeId, resumeId))
      .orderBy(desc(jobMatches.createdAt));
  }

  async createJobMatch(insertJobMatch: InsertJobMatch): Promise<JobMatch> {
    const result = await this.db.insert(jobMatches).values(insertJobMatch).returning();
    return result[0];
  }

  async updateJobMatchResponses(
    id: string,
    gapResponses: Array<{ gapIndex: number; proficiencyLevel: string }>,
    finalVerdict: string,
    shouldApply: boolean
  ): Promise<JobMatch | undefined> {
    const result = await this.db
      .update(jobMatches)
      .set({
        gapResponses: gapResponses as any,
        finalVerdict,
        shouldApply,
      })
      .where(eq(jobMatches.id, id))
      .returning();
    return result[0];
  }

  async updateJobMatchResume(id: string, tailoredResumeContent: string): Promise<JobMatch | undefined> {
    const result = await this.db
      .update(jobMatches)
      .set({ tailoredResumeContent })
      .where(eq(jobMatches.id, id))
      .returning();
    return result[0];
  }
}

const dbUrl = process.env.DATABASE_URL;
export const storage = dbUrl ? new DbStorage(dbUrl) : new MemStorage();
