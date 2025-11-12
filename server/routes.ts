import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import multer from "multer";
import { storage } from "./storage";
import { extractText } from "./fileExtractor";
import { analyzeResume } from "./gemini";
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

  const httpServer = createServer(app);

  return httpServer;
}
