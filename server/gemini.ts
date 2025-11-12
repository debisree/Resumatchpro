import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

interface ResumeAnalysis {
  completenessScore: number;
  completenessRationale: string;
  sectionScores: {
    summary: number;
    education: number;
    experience: number;
    other: number;
  };
  suggestions: string[];
}

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  const prompt = `You are an expert resume reviewer and career coach. Analyze the following resume text and provide a comprehensive evaluation.

RESUME TEXT:
${resumeText}

Evaluate the resume across these dimensions:

1. COMPLETENESS SCORE (0-100):
   - Assess how complete and comprehensive the resume is
   - Consider: contact info, summary/objective, work experience, education, skills, achievements
   - Provide a numerical score and brief rationale

2. SECTION QUALITY SCORES (0-5 each):
   - Summary: Quality and impact of professional summary/objective
   - Education: Completeness and presentation of educational background
   - Experience: Depth, relevance, and presentation of work history
   - Other: Projects, volunteering, awards, skills, certifications

   Scoring guide:
   0 = Missing or severely lacking
   1-2 = Weak, needs significant improvement
   3 = Fair, meets basic requirements
   4 = Strong, well-presented
   5 = Perfect, exceptional quality

3. IMPROVEMENT SUGGESTIONS:
   - Provide 5-8 specific, actionable suggestions to improve the resume
   - Focus on high-impact changes
   - Be constructive and specific

Respond with structured JSON only, no other text.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          completenessScore: { 
            type: Type.INTEGER,
            description: "Overall completeness score from 0 to 100"
          },
          completenessRationale: { 
            type: Type.STRING,
            description: "Brief explanation of the completeness score"
          },
          sectionScores: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.INTEGER },
              education: { type: Type.INTEGER },
              experience: { type: Type.INTEGER },
              other: { type: Type.INTEGER }
            },
            required: ["summary", "education", "experience", "other"]
          },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "5-8 specific improvement suggestions"
          }
        },
        required: ["completenessScore", "completenessRationale", "sectionScores", "suggestions"]
      }
    }
  });

  const analysisData = JSON.parse(response.text || "{}");
  
  return {
    completenessScore: Math.min(100, Math.max(0, analysisData.completenessScore || 0)),
    completenessRationale: analysisData.completenessRationale || "No rationale provided",
    sectionScores: {
      summary: Math.min(5, Math.max(0, analysisData.sectionScores?.summary || 0)),
      education: Math.min(5, Math.max(0, analysisData.sectionScores?.education || 0)),
      experience: Math.min(5, Math.max(0, analysisData.sectionScores?.experience || 0)),
      other: Math.min(5, Math.max(0, analysisData.sectionScores?.other || 0)),
    },
    suggestions: (analysisData.suggestions || []).slice(0, 8),
  };
}
