import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import multer from "multer";
import { storage } from "./storage";
import { extractText } from "./fileExtractor";
import { analyzeResume, analyzeJobMatch, generateJobDescription } from "./gemini";
import { insertUserSchema } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "resumatch-pro-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username } = insertUserSchema.parse(req.body);
      
      let user = await storage.getUserByUsername(username);
      if (!user) {
        user = await storage.createUser({ username });
      }
      
      req.session.userId = user.id;
      res.json({ user });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    res.json({ user });
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.post("/api/resumes/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const extractedText = await extractText(req.file.buffer, req.file.mimetype);

      if (!extractedText || extractedText.length < 50) {
        return res.status(400).json({ 
          message: "Could not extract sufficient text from the file. Please ensure the file contains readable text." 
        });
      }

      const resume = await storage.createResume({
        userId: req.session.userId,
        filename: req.file.originalname,
        filesize: req.file.size,
        mimeType: req.file.mimetype,
        extractedText,
      });

      res.json(resume);
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: error.message || "Failed to upload resume" });
    }
  });

  app.get("/api/resumes", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const resumes = await storage.getResumesByUserId(req.session.userId);
      res.json(resumes);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch resumes" });
    }
  });

  app.get("/api/resumes/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (resume.userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(resume);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch resume" });
    }
  });

  app.post("/api/resumes/:id/analyze", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }

      if (resume.userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const analysisResult = await analyzeResume(resume.extractedText);

      const analysis = await storage.createAnalysis({
        resumeId: resume.id,
        completenessScore: analysisResult.completenessScore,
        completenessRationale: analysisResult.completenessRationale,
        sectionScores: analysisResult.sectionScores,
        suggestions: analysisResult.suggestions,
      });

      res.json(analysis);
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: error.message || "Failed to analyze resume" });
    }
  });

  app.get("/api/analyses/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      const resume = await storage.getResume(analysis.resumeId);
      if (!resume || resume.userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch analysis" });
    }
  });

  app.post("/api/job-matches/analyze", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { jobDescription, jobRole, jobLocation } = req.body;

      const resumes = await storage.getResumesByUserId(req.session.userId);
      if (!resumes || resumes.length === 0) {
        return res.status(400).json({ message: "Please upload a resume first" });
      }

      const resume = resumes[0];
      let finalJobDescription = jobDescription;

      if (!finalJobDescription && jobRole && jobLocation) {
        finalJobDescription = await generateJobDescription(jobRole, jobLocation);
      }

      if (!finalJobDescription) {
        return res.status(400).json({ message: "Job description is required" });
      }

      const matchResult = await analyzeJobMatch(resume.extractedText, finalJobDescription);

      const jobMatch = await storage.createJobMatch({
        resumeId: resume.id,
        jobDescription: finalJobDescription,
        jobRole: jobRole || null,
        jobLocation: jobLocation || null,
        alignmentScore: matchResult.alignmentScore,
        alignmentRationale: matchResult.alignmentRationale,
        gaps: matchResult.gaps,
        strengths: matchResult.strengths,
      });

      res.json(jobMatch);
    } catch (error: any) {
      console.error("Job match analysis error:", error);
      res.status(500).json({ message: error.message || "Failed to analyze job match" });
    }
  });

  app.get("/api/job-matches/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const jobMatch = await storage.getJobMatch(req.params.id);
      if (!jobMatch) {
        return res.status(404).json({ message: "Job match not found" });
      }

      const resume = await storage.getResume(jobMatch.resumeId);
      if (!resume || resume.userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(jobMatch);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch job match" });
    }
  });

  app.post("/api/job-matches/:id/submit-responses", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const jobMatch = await storage.getJobMatch(req.params.id);
      if (!jobMatch) {
        return res.status(404).json({ message: "Job match not found" });
      }

      const resume = await storage.getResume(jobMatch.resumeId);
      if (!resume || resume.userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { gapResponses } = req.body;
      if (!Array.isArray(gapResponses)) {
        return res.status(400).json({ message: "Gap responses must be an array" });
      }

      const validProficiencyLevels = ["none", "basic", "moderate", "advanced"];
      for (const response of gapResponses) {
        if (typeof response.gapIndex !== "number" || 
            !validProficiencyLevels.includes(response.proficiencyLevel)) {
          return res.status(400).json({ message: "Invalid gap response format" });
        }
      }

      const { generateFinalVerdict } = await import("./gemini.js");
      const verdict = await generateFinalVerdict(
        resume.extractedText,
        jobMatch.jobDescription,
        jobMatch.alignmentScore,
        jobMatch.gaps,
        gapResponses
      );

      const updated = await storage.updateJobMatchResponses(
        req.params.id,
        gapResponses,
        verdict.verdict,
        verdict.shouldApply
      );

      res.json(updated);
    } catch (error: any) {
      console.error("Submit responses error:", error);
      res.status(500).json({ message: error.message || "Failed to submit responses" });
    }
  });

  app.post("/api/job-matches/:id/generate-resume", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const jobMatch = await storage.getJobMatch(req.params.id);
      if (!jobMatch) {
        return res.status(404).json({ message: "Job match not found" });
      }

      const resume = await storage.getResume(jobMatch.resumeId);
      if (!resume || resume.userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (!jobMatch.gapResponses || jobMatch.gapResponses.length === 0) {
        return res.status(400).json({ message: "Please submit gap responses first" });
      }

      const { generateTailoredResume } = await import("./gemini.js");
      const { changesSummary, resumeMarkdown } = await generateTailoredResume(
        resume.extractedText,
        jobMatch.jobDescription,
        jobMatch.strengths,
        jobMatch.gaps,
        jobMatch.gapResponses
      );

      const updated = await storage.updateJobMatchResume(req.params.id, changesSummary, resumeMarkdown);

      res.json(updated);
    } catch (error: any) {
      console.error("Generate resume error:", error);
      res.status(500).json({ message: error.message || "Failed to generate tailored resume" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
