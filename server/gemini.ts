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
  const prompt = `You are a brutally honest resume expert and career coach. Act as a recruiter reviewing this resume - be direct about weaknesses.

RESUME TEXT:
${resumeText}

Evaluate the resume across these dimensions:

1. COMPLETENESS SCORE (0-100):
   - Assess how complete and comprehensive the resume is
   - Consider: contact info, summary/objective, work experience, education, skills, achievements
   - Provide a numerical score and brutally honest rationale

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

3. IMPROVEMENT SUGGESTIONS (BE BRUTALLY HONEST):
   - Provide 5-8 specific, actionable suggestions to improve the resume
   - Call out overused buzzwords (e.g., "team player", "hard worker", "passionate")
   - Identify vague statements lacking metrics or outcomes
   - Flag weak action verbs (e.g., "responsible for", "helped with", "worked on")
   - Point out where quantifiable results are missing (percentages, dollar amounts, time saved, scale)
   - Suggest stronger action verbs (led, architected, scaled, reduced, increased, launched)
   - Be direct: if something is weak or generic, say so clearly
   - Focus on results-driven, impact-oriented language

CRITICAL: When suggesting improvements about metrics:
- DO say: "Add quantifiable metrics to demonstrate impact" 
- DO say: "Replace 'managed projects' with specific outcomes and scale"
- DO NOT invent or suggest specific numbers that aren't in the resume
- DO NOT hallucinate metrics - only encourage the user to add their own real numbers

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
): Promise<{ changesSummary: string; resumeMarkdown: string }> {
  const skillsToAdd = gapResponses
    .filter(response => 
      response.proficiencyLevel !== 'none' && 
      ['basic', 'moderate', 'advanced'].includes(response.proficiencyLevel.toLowerCase())
    )
    .map((response) => {
      const gap = gaps[response.gapIndex];
      if (!gap) return null;
      return `- ${gap.category}: User confirmed ${response.proficiencyLevel} proficiency - ADD this to Skills section`;
    })
    .filter(Boolean)
    .join("\n");

  const prompt = `You are an expert resume writer specializing in ATS-friendly, results-driven resumes. Create a tailored resume optimized for the target job using quantifiable, impact-oriented language.

ORIGINAL RESUME:
${originalResumeText}

TARGET JOB DESCRIPTION:
${jobDescription.substring(0, 2000)}

IDENTIFIED STRENGTHS TO HIGHLIGHT:
${strengths.join("\n- ")}

SKILLS USER CONFIRMED THEY HAVE (MUST ADD TO RESUME):
${skillsToAdd || "None - user did not confirm proficiency in gap areas"}

CRITICAL RULES FOR RESULTS-DRIVEN LANGUAGE:

**QUANTIFIABLE IMPACT (NO HALLUCINATION)**:
- Use existing metrics from the original resume - never invent new numbers
- If original says "improved performance", keep it as-is or enhance language without adding fake metrics
- Transform weak verbs into strong action verbs: "responsible for" → "led", "worked on" → "architected", "helped with" → "drove"
- Emphasize scale and impact using language, not invented numbers
- Examples of acceptable enhancements:
  ✓ "Managed team" → "Led cross-functional team in delivering critical infrastructure"
  ✓ "Worked on API" → "Architected and deployed REST API serving production traffic"
  ✓ "Improved performance" → "Optimized system performance through caching and query refinement"
  ✗ "Improved performance" → "Improved performance by 60%" (NEVER add fake metrics)
  ✗ "Led team" → "Led team of 5 engineers" (NEVER invent team sizes)

**ACTION VERB EXCELLENCE**:
- Replace passive language with strong action verbs
- Use: architected, engineered, led, drove, launched, scaled, optimized, reduced, increased, transformed, established, spearheaded
- Avoid: responsible for, worked on, helped with, participated in, involved in

MANDATORY PRESERVATION RULES:

1. **PRESERVE ALL SECTIONS**: Keep ALL original sections
   - Keep Volunteering, Awards, Certifications, Publications, Projects, Languages - EVERYTHING
   - If a section exists in the original, it MUST exist in the tailored version

2. **PRESERVE ALL CONTACT LINKS**: 
   - Keep ALL contact information exactly as-is: email, phone, LinkedIn, GitHub, Google Scholar, portfolio, website, etc.
   - Make ALL links clickable using markdown format: [LinkedIn](URL) or [Google Scholar](URL)
   - Do NOT drop any links from the header

3. **ADD USER-CONFIRMED SKILLS**:
   - User rated themselves on missing skills - if they have basic/moderate/advanced proficiency, ADD those skills to the Skills section
   - This is NOT hallucination - the user CONFIRMED they have these skills
   - Example: If user said "Docker: moderate proficiency", add Docker to Skills section

4. **SECTION ORDER** (mandatory):
   - Header: Full Name + ALL Contact Links (email, phone, LinkedIn, GitHub, Google Scholar, portfolio, etc.)
   - Professional Summary (2-3 sentences optimized for target role)
   - **Skills** (RIGHT AFTER SUMMARY - organize by category, include user-confirmed skills)
   - Professional Experience (reorder bullets to emphasize relevant work)
   - Education
   - Certifications (if in original)
   - Volunteering (if in original)
   - Awards (if in original)
   - Any other sections from original

5. **OUTPUT FORMAT** - Return TWO sections separated by "===SEPARATOR===":

SECTION 1 - CHANGES SUMMARY (for UI display only):
# Changes Made

## Language Enhancements:
- [List 4-6 specific language improvements, e.g., "Transformed 'worked on microservices' to 'architected and deployed microservices'", "Enhanced 'managed team' to 'led cross-functional engineering team'"]

## Skills Added:
- [List skills you added based on user's gap proficiency responses]

## Strengths Emphasized:
- [List skills/experiences from original that match job requirements]

## Structure Preserved:
- All sections maintained including Volunteering, Awards, Certifications
- All contact links preserved (LinkedIn, GitHub, Google Scholar, email, phone)
- All existing metrics preserved without hallucination

===SEPARATOR===

SECTION 2 - ACTUAL RESUME (for DOCX download):
# [FULL NAME]
[Email](mailto:email) | [Phone] | [LinkedIn](URL) | [GitHub](URL) | [Google Scholar](URL) | [Portfolio](URL)

## Professional Summary
[2-3 sentences optimized for job]

## Skills
**Technical Skills:** [Include user-confirmed skills like Docker, REST API, etc.]
**Programming:** [Languages]
**Tools & Platforms:** [Tools]

## Professional Experience
**[Job Title]** | **[Company]** | [Dates]
- [Bullet with relevant keywords]

## Education
**[Degree]** | [Institution] | [Year]

## Certifications
[If in original]

## Volunteering
[If in original]

## Awards
[If in original]

FORMATTING RULES:
- Use markdown: # for name, ## for sections, - for bullets, **bold** for emphasis
- Make ALL URLs clickable: [Text](URL)
- No tables or special formatting
- Clean, ATS-friendly structure

Respond with BOTH sections separated by ===SEPARATOR===`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const fullResponse = response.text || "";
  
  const separator = "===SEPARATOR===";
  const separatorIndex = fullResponse.indexOf(separator);
  
  if (separatorIndex === -1) {
    console.warn("Gemini response missing separator - using fallback");
    return {
      changesSummary: "Unable to generate changes summary",
      resumeMarkdown: fullResponse,
    };
  }
  
  const changesSummary = fullResponse.substring(0, separatorIndex).trim();
  const resumeMarkdown = fullResponse.substring(separatorIndex + separator.length).trim();
  
  return {
    changesSummary,
    resumeMarkdown,
  };
}

interface CareerRoadmapResult {
  currentGaps: string[];
  skillsToAcquire: string[];
  actionPlan: Array<{
    phase: string;
    duration: string;
    actions: string[];
  }>;
  resources: string[];
  milestones: string[];
}

export async function generateCareerRoadmap(
  resumeText: string,
  dreamRole: string,
  dreamLocation: string,
  timeframe: string
): Promise<CareerRoadmapResult> {
  const prompt = `You are an expert career coach helping someone transition to their dream role.

CURRENT RESUME:
${resumeText}

CAREER GOAL:
Dream Role: ${dreamRole}
Dream Location: ${dreamLocation}
Timeframe: ${timeframe}

Your task is to provide a comprehensive, actionable career roadmap that guides this person from their current position to their dream role within the specified timeframe.

Analyze the resume and provide:

1. CURRENT GAPS (3-6 items):
   - What specific skills, experiences, or qualifications are they currently lacking for this dream role?
   - Be honest but constructive
   - Focus on technical skills, soft skills, certifications, and experience gaps

2. SKILLS TO ACQUIRE (5-8 specific skills):
   - List concrete skills they need to develop
   - Include both technical and soft skills
   - Prioritize based on the timeframe and dream role requirements

3. ACTION PLAN (3-4 phases):
   - Break down the journey into logical phases based on the timeframe
   - Each phase should have:
     * phase: Name of the phase (e.g., "Foundation Building", "Skill Development", "Experience Gain", "Job Search & Interview Prep")
     * duration: Time allocation (e.g., "Months 1-3", "Months 4-8")
     * actions: 3-5 specific actions to take during this phase
   - Make it realistic and achievable within the given timeframe
   - Progress logically from skill building to job search

4. RESOURCES (4-6 recommendations):
   - Suggest specific online courses, certifications, books, or platforms
   - Include both free and paid options
   - Be specific (e.g., "Google Cloud Professional Data Engineer Certification" not just "cloud certification")

5. MILESTONES (4-6 checkpoints):
   - Define clear, measurable milestones to track progress
   - Make them specific and time-bound
   - Include both skill-based and career-based milestones

Be encouraging but realistic. Consider the location-specific job market if relevant. Make all guidance actionable and specific to their situation.

Respond with structured JSON only, no other text.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          currentGaps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-6 current gaps or weaknesses"
          },
          skillsToAcquire: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "5-8 specific skills to develop"
          },
          actionPlan: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phase: { type: Type.STRING },
                duration: { type: Type.STRING },
                actions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["phase", "duration", "actions"]
            },
            description: "3-4 phases with specific actions"
          },
          resources: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "4-6 specific learning resources"
          },
          milestones: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "4-6 measurable progress checkpoints"
          }
        },
        required: ["currentGaps", "skillsToAcquire", "actionPlan", "resources", "milestones"]
      }
    }
  });

  const roadmapData = JSON.parse(response.text || "{}");
  
  return {
    currentGaps: roadmapData.currentGaps || [],
    skillsToAcquire: roadmapData.skillsToAcquire || [],
    actionPlan: roadmapData.actionPlan || [],
    resources: roadmapData.resources || [],
    milestones: roadmapData.milestones || [],
  };
}
