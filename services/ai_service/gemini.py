import google.generativeai as genai
import json
import os
import re
from typing import Dict, List, Any

gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

model = genai.GenerativeModel('gemini-2.0-flash-exp')


def clean_json_response(text: str) -> str:
    """Clean AI response to extract valid JSON."""
    text = text.strip()
    
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    
    text = text.strip()
    
    brace_start = text.find('{')
    if brace_start != -1:
        brace_count = 0
        end_pos = -1
        for i, char in enumerate(text[brace_start:], brace_start):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_pos = i
                    break
        if end_pos != -1:
            text = text[brace_start:end_pos + 1]
    
    return text


def analyze_resume(resume_text: str) -> Dict[str, Any]:
    from datetime import datetime
    current_year = datetime.now().year
    
    prompt = f"""You are a brutally honest resume expert and career coach. Act as a recruiter reviewing this resume - be direct about weaknesses.

IMPORTANT: The current year is {current_year}. When calculating years of experience:
- If someone worked from 2021 to Present/{current_year}, that is {current_year - 2021} years
- If dates say "to Present" or "to Current", use {current_year} as the end year
- Calculate experience accurately based on actual start and end dates

RESUME TEXT:
{resume_text}

Evaluate the resume across these dimensions:

1. COMPLETENESS SCORE (0-100):
   - Assess how complete and comprehensive the resume is
   - Consider: contact info, summary/objective, work experience, education, skills, achievements
   - Provide a numerical score and brutally honest rationale
   - When mentioning years of experience, calculate accurately using {current_year} as the current year

2. SECTION QUALITY SCORES (0-5 each):
   - Summary: Quality and impact of professional summary/objective
   - Education: Completeness and presentation of educational background
   - Experience: Depth, relevance, and presentation of work history
   - Other: Projects, volunteering, awards, skills, certifications

3. IMPROVEMENT SUGGESTIONS (BE BRUTALLY HONEST):
   - Provide 5-8 specific, actionable suggestions
   - Call out overused buzzwords
   - Identify vague statements lacking metrics
   - Flag weak action verbs
   - Point out where quantifiable results are missing
   - DO NOT invent or suggest specific numbers

Return ONLY valid JSON with this exact structure:
{{"completenessScore": 75, "completenessRationale": "...", "sectionScores": {{"summary": 3, "education": 4, "experience": 3, "other": 2}}, "suggestions": ["...", "..."]}}"""

    try:
        response = model.generate_content(prompt)
        text = clean_json_response(response.text)
        data = json.loads(text)
        
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
    prompt = f"""You are an expert career coach. Analyze how well this resume aligns with the job description.

RESUME TEXT:
{resume_text}

JOB DESCRIPTION:
{job_description}

Provide a comprehensive match analysis with:
1. ALIGNMENT SCORE (0-100)
2. GAPS (3-8 items with category, description, severity: high/medium/low)
3. STRENGTHS (3-6 items)
4. RECOMMENDATIONS (5-8 items)

Return ONLY valid JSON:
{{"alignmentScore": 70, "alignmentRationale": "...", "gaps": [{{"category": "...", "description": "...", "severity": "high"}}], "strengths": ["..."], "recommendations": ["..."]}}"""

    try:
        response = model.generate_content(prompt)
        text = clean_json_response(response.text)
        data = json.loads(text)
        
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
    prompt = f"""Generate a realistic job description for a {role} position in {location}.

Include:
- Company overview (generic tech company)
- Role responsibilities (5-7 key responsibilities)
- Required qualifications
- Preferred qualifications
- Benefits overview

Respond with just the job description text, no JSON."""

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
    gap_details = []
    for index, gap in enumerate(gaps):
        response = next((r for r in gap_responses if r.get("gapIndex") == index), None)
        proficiency = response.get("proficiencyLevel", "not provided") if response else "not provided"
        gap_details.append(f"{gap['category']} - {gap['description']} (Severity: {gap['severity']}, Proficiency: {proficiency})")
    
    prompt = f"""You are an expert career coach. Based on the analysis and user's proficiency responses, provide a final recommendation.

ALIGNMENT SCORE: {alignment_score}%

GAPS AND PROFICIENCY:
{chr(10).join(gap_details)}

RESUME (excerpt):
{resume_text[:2000]}

JOB DESCRIPTION (excerpt):
{job_description[:2000]}

Provide:
1. A comprehensive final verdict (2-3 paragraphs) - be encouraging!
2. A boolean recommendation on whether they should apply (true if score >= 50% or has proficiency in gaps)

Return ONLY valid JSON:
{{"verdict": "...", "shouldApply": true}}"""

    try:
        response = model.generate_content(prompt)
        text = clean_json_response(response.text)
        data = json.loads(text)
        
        return {
            "verdict": data.get("verdict", "Unable to generate verdict."),
            "shouldApply": data.get("shouldApply", True)
        }
    except Exception as e:
        raise ValueError(f"Failed to generate verdict: {str(e)}")


def generate_tailored_resume(
    original_resume_text: str,
    job_description: str,
    strengths: List[str],
    gaps: List[Dict[str, str]],
    gap_responses: List[Dict[str, Any]]
) -> Dict[str, str]:
    skills_to_add = []
    for response in gap_responses:
        if response.get("proficiencyLevel") in ["basic", "moderate", "advanced"]:
            gap_idx = response.get("gapIndex", 0)
            if gap_idx < len(gaps):
                gap = gaps[gap_idx]
                skills_to_add.append(f"- {gap['category']}: {response['proficiencyLevel']} proficiency")
    
    skills_text = chr(10).join(skills_to_add) if skills_to_add else "None confirmed"
    
    prompt = f"""You are an expert resume writer. Create a tailored, ATS-optimized resume.

ORIGINAL RESUME:
{original_resume_text}

TARGET JOB:
{job_description[:2000]}

STRENGTHS TO HIGHLIGHT:
{chr(10).join(f'- {s}' for s in strengths)}

SKILLS USER CONFIRMED:
{skills_text}

RULES:
- Transform weak verbs: "responsible for" → "led", "worked on" → "architected"
- NEVER invent metrics - only use existing numbers from original resume
- Preserve ALL sections from original (Volunteering, Awards, Certifications, Memberships, etc.)
- Keep ALL contact links exactly as they appear
- Add confirmed skills to Skills section
- Use LaTeX (not L ATEX) when referencing that tool

RETURN ONLY THIS JSON (no markdown, no extra text):
{{
  "changes_summary": ["change 1", "change 2", "change 3"],
  "header": {{
    "name": "Full Name, Ph.D.",
    "titles": ["Data Scientist", "Computational Physicist"],
    "email": "email@example.com",
    "phone": "(xxx) xxx-xxxx",
    "location": "City, State",
    "linkedin": "linkedin.com/in/username",
    "github": "github.com/username",
    "kaggle": "kaggle.com/username",
    "medium": "medium.com/@username",
    "google_scholar": "scholar.google.com/citations?user=xxx"
  }},
  "sections": [
    {{
      "title": "PROFESSIONAL SUMMARY",
      "type": "paragraph",
      "content": "2-3 sentences here."
    }},
    {{
      "title": "TECHNICAL SKILLS",
      "type": "skills",
      "content": [
        {{"category": "Languages & Tools", "items": "Python, SQL, etc."}},
        {{"category": "ML/DL", "items": "TensorFlow, PyTorch"}}
      ]
    }},
    {{
      "title": "CERTIFICATIONS",
      "type": "inline",
      "content": "Cert1; Cert2; Cert3"
    }},
    {{
      "title": "EXPERIENCE",
      "type": "jobs",
      "content": [
        {{
          "job_title": "Job Title",
          "company": "Company Name",
          "location": "City, State",
          "dates": "Start – End",
          "bullets": ["Achievement 1", "Achievement 2"]
        }}
      ]
    }},
    {{
      "title": "EDUCATION",
      "type": "education",
      "content": [
        {{
          "degree": "Ph.D. in Field",
          "institution": "University Name",
          "dates": "Year",
          "bullets": ["Detail 1"]
        }}
      ]
    }},
    {{
      "title": "PROFESSIONAL MEMBERSHIP, LEADERSHIP & SERVICE",
      "type": "bullets",
      "content": ["Item 1", "Item 2"]
    }},
    {{
      "title": "AWARDS",
      "type": "bullets",
      "content": ["Award 1", "Award 2"]
    }}
  ]
}}

Include ALL original sections. Return ONLY valid JSON."""

    try:
        response = model.generate_content(prompt)
        full_response = response.text
        
        json_text = clean_json_response(full_response)
        resume_data = json.loads(json_text)
        
        changes = resume_data.get('changes_summary', [])
        changes_text = '\n'.join(f"• {c}" for c in changes) if changes else "Resume optimized for ATS."
        
        return {
            "changesSummary": changes_text,
            "resumeMarkdown": json.dumps(resume_data),
            "resumeJson": resume_data
        }
    except json.JSONDecodeError:
        return {
            "changesSummary": "Resume optimized for ATS and tailored to job requirements.",
            "resumeMarkdown": full_response
        }
    except Exception as e:
        raise ValueError(f"Failed to generate tailored resume: {str(e)}")


def generate_career_roadmap(
    resume_text: str,
    dream_role: str,
    dream_location: str,
    timeframe: str
) -> Dict[str, Any]:
    prompt = f"""You are an expert career coach helping someone transition to their dream role.

CURRENT RESUME:
{resume_text}

CAREER GOAL:
Dream Role: {dream_role}
Dream Location: {dream_location}
Timeframe: {timeframe}

Provide a comprehensive career roadmap:

1. CURRENT GAPS (3-6 items)
2. SKILLS TO ACQUIRE (5-8 specific skills)
3. ACTION PLAN (3-4 phases with phase name, duration, and 3-5 actions each)
4. RESOURCES (4-6 specific recommendations)
5. MILESTONES (4-6 measurable checkpoints)

Return ONLY valid JSON:
{{"currentGaps": ["..."], "skillsToAcquire": ["..."], "actionPlan": [{{"phase": "...", "duration": "...", "actions": ["..."]}}], "resources": ["..."], "milestones": ["..."]}}"""

    try:
        response = model.generate_content(prompt)
        text = clean_json_response(response.text)
        data = json.loads(text)
        
        return {
            "currentGaps": data.get("currentGaps", []),
            "skillsToAcquire": data.get("skillsToAcquire", []),
            "actionPlan": data.get("actionPlan", []),
            "resources": data.get("resources", []),
            "milestones": data.get("milestones", [])
        }
    except Exception as e:
        raise ValueError(f"Failed to generate career roadmap: {str(e)}")
