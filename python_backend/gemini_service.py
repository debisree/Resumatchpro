import google.generativeai as genai
from typing import Dict, List, Any
import json
from .config import GEMINI_API_KEY

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Initialize model
model = genai.GenerativeModel('gemini-2.0-flash-exp')

def analyze_resume(resume_text: str) -> Dict[str, Any]:
    """Analyze resume and return completeness score, section scores, and suggestions"""
    prompt = f"""You are a brutally honest resume expert and career coach. Act as a recruiter reviewing this resume - be direct about weaknesses.

RESUME TEXT:
{resume_text}

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

Respond with structured JSON only, no other text."""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "object",
                    "properties": {
                        "completenessScore": {
                            "type": "integer",
                            "description": "Overall completeness score from 0 to 100"
                        },
                        "completenessRationale": {
                            "type": "string",
                            "description": "Brief explanation of the completeness score"
                        },
                        "sectionScores": {
                            "type": "object",
                            "properties": {
                                "summary": {"type": "integer"},
                                "education": {"type": "integer"},
                                "experience": {"type": "integer"},
                                "other": {"type": "integer"}
                            },
                            "required": ["summary", "education", "experience", "other"]
                        },
                        "suggestions": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "5-8 specific improvement suggestions"
                        }
                    },
                    "required": ["completenessScore", "completenessRationale", "sectionScores", "suggestions"]
                }
            )
        )
        
        data = json.loads(response.text)
        
        return {
            "completenessScore": min(100, max(0, data.get("completenessScore", 0))),
            "completenessRationale": data.get("completenessRationale", "No rationale provided"),
            "sectionScores": {
                "summary": min(5, max(0, data.get("sectionScores", {}).get("summary", 0))),
                "education": min(5, max(0, data.get("sectionScores", {}).get("education", 0))),
                "experience": min(5, max(0, data.get("sectionScores", {}).get("experience", 0))),
                "other": min(5, max(0, data.get("sectionScores", {}).get("other", 0))),
            },
            "suggestions": data.get("suggestions", [])[:8]
        }
    except Exception as e:
        raise ValueError(f"Failed to analyze resume: {str(e)}")


def analyze_job_match(resume_text: str, job_description: str) -> Dict[str, Any]:
    """Analyze job match and return alignment score, gaps, and strengths"""
    prompt = f"""You are an expert career coach and recruiter. Analyze how well this resume aligns with the job description.

RESUME TEXT:
{resume_text}

JOB DESCRIPTION:
{job_description}

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

Respond with structured JSON only, no other text."""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "object",
                    "properties": {
                        "alignmentScore": {
                            "type": "integer",
                            "description": "Percentage match score from 0 to 100"
                        },
                        "alignmentRationale": {
                            "type": "string",
                            "description": "Brief explanation of the alignment score"
                        },
                        "gaps": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "category": {"type": "string"},
                                    "description": {"type": "string"},
                                    "severity": {
                                        "type": "string",
                                        "enum": ["high", "medium", "low"]
                                    }
                                },
                                "required": ["category", "description", "severity"]
                            },
                            "description": "3-8 specific gaps between resume and job requirements"
                        },
                        "strengths": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "3-6 strong alignment points"
                        },
                        "recommendations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "5-8 specific actionable recommendations"
                        }
                    },
                    "required": ["alignmentScore", "alignmentRationale", "gaps", "strengths", "recommendations"]
                }
            )
        )
        
        data = json.loads(response.text)
        
        return {
            "alignmentScore": min(100, max(0, data.get("alignmentScore", 0))),
            "alignmentRationale": data.get("alignmentRationale", "No rationale provided"),
            "gaps": data.get("gaps", [])[:8],
            "strengths": data.get("strengths", [])[:6],
            "recommendations": data.get("recommendations", [])[:8]
        }
    except Exception as e:
        raise ValueError(f"Failed to analyze job match: {str(e)}")


def generate_job_description(role: str, location: str) -> str:
    """Generate a job description for a role and location"""
    prompt = f"""Generate a realistic, representative job description for a {role} position in {location}.

Include:
- Company overview (generic tech company)
- Role responsibilities (5-7 key responsibilities)
- Required qualifications (education, years of experience, must-have skills)
- Preferred qualifications (nice-to-have skills, bonus experiences)
- Benefits overview

Make it professional and typical of real job postings in the {location} market for this role.

Respond with just the job description text, no JSON or extra formatting."""

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        raise ValueError(f"Failed to generate job description: {str(e)}")


def generate_final_verdict(
    resume_text: str,
    job_description: str,
    alignment_score: int,
    gaps: List[Dict[str, str]],
    gap_responses: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generate final verdict based on gap responses"""
    gap_details = []
    for index, gap in enumerate(gaps):
        response = next((r for r in gap_responses if r.get("gapIndex") == index), None)
        proficiency = response.get("proficiencyLevel", "not provided") if response else "not provided"
        gap_details.append(
            f"{gap['category']} - {gap['description']} (Severity: {gap['severity']}, User's proficiency: {proficiency})"
        )
    
    gap_text = "\n".join(gap_details)
    
    prompt = f"""You are an expert career coach. Based on the resume analysis and user's proficiency responses, provide a final recommendation.

RESUME ALIGNMENT SCORE: {alignment_score}%

GAPS AND USER'S PROFICIENCY:
{gap_text}

RESUME:
{resume_text[:2000]}

JOB DESCRIPTION:
{job_description[:2000]}

Based on:
1. The alignment score ({alignment_score}%)
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

Respond with structured JSON only."""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "object",
                    "properties": {
                        "verdict": {
                            "type": "string",
                            "description": "2-3 paragraph final verdict and recommendation"
                        },
                        "shouldApply": {
                            "type": "boolean",
                            "description": "Whether the user should apply for this position"
                        }
                    },
                    "required": ["verdict", "shouldApply"]
                }
            )
        )
        
        data = json.loads(response.text)
        
        return {
            "verdict": data.get("verdict", "Unable to generate verdict at this time."),
            "shouldApply": data.get("shouldApply", True)
        }
    except Exception as e:
        raise ValueError(f"Failed to generate final verdict: {str(e)}")


def generate_tailored_resume(
    original_resume_text: str,
    job_description: str,
    strengths: List[str],
    gaps: List[Dict[str, str]],
    gap_responses: List[Dict[str, Any]]
) -> Dict[str, str]:
    """Generate tailored resume based on job description and gap responses"""
    # ... (rest of the implementation will continue in the next file)
    skills_to_add = []
    for response in gap_responses:
        if response.get("proficiencyLevel") != "none" and response.get("proficiencyLevel") in ["basic", "moderate", "advanced"]:
            gap = gaps[response.get("gapIndex")]
            if gap:
                skills_to_add.append(f"- {gap['category']}: User confirmed {response['proficiencyLevel']} proficiency - ADD this to Skills section")
    
    skills_text = "\n".join(skills_to_add) if skills_to_add else "None - user did not confirm proficiency in gap areas"
    
    prompt = f"""You are an expert resume writer specializing in ATS-friendly, results-driven resumes. Create a tailored resume optimized for the target job using quantifiable, impact-oriented language.

ORIGINAL RESUME:
{original_resume_text}

TARGET JOB DESCRIPTION:
{job_description[:2000]}

IDENTIFIED STRENGTHS TO HIGHLIGHT:
{chr(10).join(f'- {s}' for s in strengths)}

SKILLS USER CONFIRMED THEY HAVE (MUST ADD TO RESUME):
{skills_text}

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

Respond with BOTH sections separated by ===SEPARATOR==="""

    try:
        response = model.generate_content(prompt)
        full_response = response.text
        
        separator = "===SEPARATOR==="
        separator_index = full_response.find(separator)
        
        if separator_index == -1:
            return {
                "changesSummary": "Unable to generate changes summary",
                "resumeMarkdown": full_response
            }
        
        changes_summary = full_response[:separator_index].strip()
        resume_markdown = full_response[separator_index + len(separator):].strip()
        
        return {
            "changesSummary": changes_summary,
            "resumeMarkdown": resume_markdown
        }
    except Exception as e:
        raise ValueError(f"Failed to generate tailored resume: {str(e)}")


def generate_career_roadmap(
    resume_text: str,
    dream_role: str,
    dream_location: str,
    timeframe: str
) -> Dict[str, Any]:
    """Generate career roadmap"""
    prompt = f"""You are an expert career coach helping someone transition to their dream role.

CURRENT RESUME:
{resume_text}

CAREER GOAL:
Dream Role: {dream_role}
Dream Location: {dream_location}
Timeframe: {timeframe}

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

Respond with structured JSON only, no other text."""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "object",
                    "properties": {
                        "currentGaps": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "3-6 current gaps or weaknesses"
                        },
                        "skillsToAcquire": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "5-8 specific skills to develop"
                        },
                        "actionPlan": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "phase": {"type": "string"},
                                    "duration": {"type": "string"},
                                    "actions": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                },
                                "required": ["phase", "duration", "actions"]
                            },
                            "description": "3-4 phases with specific actions"
                        },
                        "resources": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "4-6 specific learning resources"
                        },
                        "milestones": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "4-6 measurable progress checkpoints"
                        }
                    },
                    "required": ["currentGaps", "skillsToAcquire", "actionPlan", "resources", "milestones"]
                }
            )
        )
        
        data = json.loads(response.text)
        
        return {
            "currentGaps": data.get("currentGaps", []),
            "skillsToAcquire": data.get("skillsToAcquire", []),
            "actionPlan": data.get("actionPlan", []),
            "resources": data.get("resources", []),
            "milestones": data.get("milestones", [])
        }
    except Exception as e:
        raise ValueError(f"Failed to generate career roadmap: {str(e)}")
