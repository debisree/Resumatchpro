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

interface JobMatchResult {
  alignmentScore: number;
  alignmentRationale: string;
  gaps: Array<{
    category: string;
    description: string;
    severity: "high" | "medium" | "low";
  }>;
  strengths: string[];
  recommendations: string[];
}

export async function analyzeJobMatch(
  resumeText: string,
  jobDescription: string
): Promise<JobMatchResult> {
  const prompt = `You are an expert career coach and recruiter. Analyze how well this resume aligns with the job description.

RESUME TEXT:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Provide a comprehensive match analysis:

1. ALIGNMENT SCORE (0-100):
   - Overall percentage match between resume and job requirements
   - Consider: required skills, experience level, education, key responsibilities
   - A score of 80-100 means excellent fit, 60-79 good fit, 40-59 moderate fit, 0-39 poor fit

2. GAPS (identify 3-8 specific gaps):
   - Category: The area of the gap (e.g., "Technical Skills", "Experience", "Education", "Certifications")
   - Description: Specific gap description
   - Severity: "high" (critical missing requirement), "medium" (important but not critical), or "low" (nice to have)

3. STRENGTHS (identify 3-6 strong matches):
   - List specific areas where the resume strongly aligns with job requirements
   - Focus on relevant skills, experiences, and qualifications that match well

4. RECOMMENDATIONS (provide 5-8 specific actions):
   - Actionable suggestions to improve alignment
   - How to address the gaps
   - What to emphasize in application/interview

Respond with structured JSON only, no other text.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          alignmentScore: {
            type: Type.INTEGER,
            description: "Percentage match score from 0 to 100"
          },
          alignmentRationale: {
            type: Type.STRING,
            description: "Brief explanation of the alignment score"
          },
          gaps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                description: { type: Type.STRING },
                severity: { 
                  type: Type.STRING,
                  enum: ["high", "medium", "low"]
                }
              },
              required: ["category", "description", "severity"]
            },
            description: "3-8 specific gaps between resume and job requirements"
          },
          strengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-6 strong alignment points"
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "5-8 specific actionable recommendations"
          }
        },
        required: ["alignmentScore", "alignmentRationale", "gaps", "strengths", "recommendations"]
      }
    }
  });

  const matchData = JSON.parse(response.text || "{}");

  return {
    alignmentScore: Math.min(100, Math.max(0, matchData.alignmentScore || 0)),
    alignmentRationale: matchData.alignmentRationale || "No rationale provided",
    gaps: (matchData.gaps || []).slice(0, 8).map((gap: any) => ({
      category: gap.category || "Unknown",
      description: gap.description || "",
      severity: (["high", "medium", "low"].includes(gap.severity) ? gap.severity : "medium") as "high" | "medium" | "low"
    })),
    strengths: (matchData.strengths || []).slice(0, 6),
    recommendations: (matchData.recommendations || []).slice(0, 8),
  };
}

export async function generateJobDescription(role: string, location: string): Promise<string> {
  const prompt = `Generate a realistic, representative job description for a ${role} position in ${location}.

Include:
- Company overview (generic tech company)
- Role responsibilities (5-7 key responsibilities)
- Required qualifications (education, years of experience, must-have skills)
- Preferred qualifications (nice-to-have skills, bonus experiences)
- Benefits overview

Make it professional and typical of real job postings in the ${location} market for this role.

Respond with just the job description text, no JSON or extra formatting.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "";
}

interface FinalVerdictResult {
  verdict: string;
  shouldApply: boolean;
}

export async function generateFinalVerdict(
  resumeText: string,
  jobDescription: string,
  alignmentScore: number,
  gaps: Array<{ category: string; description: string; severity: string }>,
  gapResponses: Array<{ gapIndex: number; proficiencyLevel: string }>
): Promise<FinalVerdictResult> {
  const gapDetails = gaps.map((gap, index) => {
    const response = gapResponses.find(r => r.gapIndex === index);
    return `${gap.category} - ${gap.description} (Severity: ${gap.severity}, User's proficiency: ${response?.proficiencyLevel || "not provided"})`;
  }).join("\n");

  const prompt = `You are an expert career coach. Based on the resume analysis and user's proficiency responses, provide a final recommendation.

RESUME ALIGNMENT SCORE: ${alignmentScore}%

GAPS AND USER'S PROFICIENCY:
${gapDetails}

RESUME:
${resumeText.substring(0, 2000)}

JOB DESCRIPTION:
${jobDescription.substring(0, 2000)}

Based on:
1. The alignment score (${alignmentScore}%)
2. The identified gaps and the user's actual proficiency levels
3. Overall fit between resume and job requirements

Provide:
1. A comprehensive final verdict (2-3 paragraphs) that:
   - Acknowledges the user's strengths
   - Discusses how their proficiency in gap areas affects their candidacy
   - Provides an honest but encouraging assessment
   - Remember: we believe in positivity and taking chances!

2. A boolean recommendation on whether they should apply:
   - true if alignment score >= 50% OR if user has at least basic proficiency in critical gaps
   - false only if alignment is very low (<30%) AND user lacks proficiency in most critical gaps
   - When in doubt, recommend true (we believe in taking chances!)

Respond with structured JSON only.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          verdict: {
            type: Type.STRING,
            description: "2-3 paragraph final verdict and recommendation"
          },
          shouldApply: {
            type: Type.BOOLEAN,
            description: "Whether the user should apply for this position"
          }
        },
        required: ["verdict", "shouldApply"]
      }
    }
  });

  const verdictData = JSON.parse(response.text || "{}");

  return {
    verdict: verdictData.verdict || "Unable to generate verdict at this time.",
    shouldApply: verdictData.shouldApply !== false,
  };
}

export async function generateTailoredResume(
  originalResumeText: string,
  jobDescription: string,
  strengths: string[],
  gaps: Array<{ category: string; description: string }>,
  gapResponses: Array<{ gapIndex: number; proficiencyLevel: string }>
): Promise<string> {
  const userProficiencies = gapResponses.map((response, idx) => {
    const gap = gaps[response.gapIndex];
    return `${gap?.category}: ${response.proficiencyLevel}`;
  }).join("\n");

  const prompt = `You are an expert resume writer specializing in ATS-friendly resumes. Create a perfectly formatted, tailored resume based on the original content.

ORIGINAL RESUME:
${originalResumeText}

JOB DESCRIPTION:
${jobDescription.substring(0, 2000)}

IDENTIFIED STRENGTHS (highlight these):
${strengths.join("\n")}

USER'S PROFICIENCY IN GAP AREAS:
${userProficiencies}

CRITICAL RULES:
1. DO NOT hallucinate or exaggerate - use ONLY information from the original resume
2. DO NOT add fake skills, experiences, or qualifications
3. Reorder and reword content to emphasize relevant experience for this specific job
4. Use keywords from the job description naturally throughout (ATS optimization)
5. Keep the same factual information but present it more effectively
6. If user has basic/moderate proficiency in a gap area mentioned, you MAY add it to skills section if it's truthful
7. Format should be clean, professional, and ATS-friendly (no tables, columns, or special formatting)
8. Include all sections: Contact Info, Professional Summary, Experience, Education, Skills

STRUCTURE:
[FULL NAME]
[Contact Information]

PROFESSIONAL SUMMARY
[2-3 sentences tailored to this role]

PROFESSIONAL EXPERIENCE
[Most Recent Job]
[Job Title] | [Company] | [Dates]
• [Achievement/responsibility relevant to target role]
• [Achievement/responsibility relevant to target role]
[Continue for all positions...]

EDUCATION
[Degree] | [Institution] | [Year]

SKILLS
[Categorized skills relevant to the job]

Respond with ONLY the formatted resume text, no JSON, no explanations, no preamble.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "";
}
