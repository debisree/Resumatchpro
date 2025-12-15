import google.generativeai as genai
import json
import os
import re
from typing import Dict, List, Any, Tuple

gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

model = genai.GenerativeModel('gemini-2.0-flash-exp')


def rule_based_analysis(resume_text: str) -> Tuple[int, Dict[str, Any]]:
    """
    Perform objective rule-based analysis of resume to detect sections and elements.
    Returns a base score (0-100) and detailed findings.
    """
    text_lower = resume_text.lower()
    findings = {
        "has_email": False,
        "has_phone": False,
        "has_linkedin": False,
        "has_github": False,
        "has_summary": False,
        "has_education": False,
        "has_experience": False,
        "has_skills": False,
        "has_projects": False,
        "has_certifications": False,
        "has_awards": False,
        "bullet_count": 0,
        "quantified_achievements": 0,
        "action_verbs_count": 0,
        "word_count": 0,
        "weak_phrases_count": 0
    }
    
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    findings["has_email"] = bool(re.search(email_pattern, resume_text))
    
    phone_patterns = [
        r'\(\d{3}\)\s*\d{3}[-.\s]\d{4}',
        r'\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b',
        r'\+1\s*\(\d{3}\)\s*\d{3}[-.\s]\d{4}',
        r'\+1[-.\s]\d{3}[-.\s]\d{3}[-.\s]\d{4}',
    ]
    phone_label_pattern = r'(?:phone|tel|cell|mobile|contact)[:\s]*[\d\(\)\-\.\s\+]+'
    has_labeled_phone = bool(re.search(phone_label_pattern, resume_text, re.IGNORECASE))
    has_pattern_phone = any(re.search(p, resume_text) for p in phone_patterns)
    findings["has_phone"] = has_labeled_phone or has_pattern_phone
    
    findings["has_linkedin"] = "linkedin" in text_lower
    findings["has_github"] = "github" in text_lower
    
    summary_indicators = ["summary", "objective", "profile", "about me", "professional summary"]
    findings["has_summary"] = any(ind in text_lower for ind in summary_indicators)
    
    education_indicators = ["education", "degree", "university", "college", "bachelor", "master", "ph.d", "phd", "diploma"]
    findings["has_education"] = any(ind in text_lower for ind in education_indicators)
    
    experience_indicators = ["experience", "employment", "work history", "professional experience", "career history"]
    findings["has_experience"] = any(ind in text_lower for ind in experience_indicators)
    
    skills_indicators = ["skills", "technical skills", "competencies", "proficiencies", "technologies"]
    findings["has_skills"] = any(ind in text_lower for ind in skills_indicators)
    
    projects_indicators = ["projects", "portfolio", "personal projects", "side projects"]
    findings["has_projects"] = any(ind in text_lower for ind in projects_indicators)
    
    cert_indicators = ["certification", "certified", "certificate", "license", "credential"]
    findings["has_certifications"] = any(ind in text_lower for ind in cert_indicators)
    
    award_indicators = ["award", "honor", "recognition", "achievement", "scholarship"]
    findings["has_awards"] = any(ind in text_lower for ind in award_indicators)
    
    bullet_patterns = [r'^[\s]*[•\-\*\→\►\✓\☑]', r'^[\s]*\d+[.\)]']
    for line in resume_text.split('\n'):
        for pattern in bullet_patterns:
            if re.match(pattern, line.strip()):
                findings["bullet_count"] += 1
                break
    
    quantified_pattern = r'\b\d+[%\+]?\b|\$[\d,]+|\b\d{1,3}(?:,\d{3})*\b'
    findings["quantified_achievements"] = len(re.findall(quantified_pattern, resume_text))
    
    strong_verbs = [
        "led", "managed", "developed", "created", "implemented", "designed", "launched",
        "increased", "reduced", "improved", "achieved", "delivered", "built", "established",
        "generated", "optimized", "spearheaded", "pioneered", "orchestrated", "transformed",
        "accelerated", "streamlined", "architected", "scaled", "drove", "executed"
    ]
    for verb in strong_verbs:
        findings["action_verbs_count"] += len(re.findall(r'\b' + verb + r'\w*\b', text_lower))
    
    weak_phrases = [
        "responsible for", "duties included", "worked on", "helped with", "assisted in",
        "participated in", "was involved in", "team player", "hard worker", "detail-oriented",
        "results-driven", "go-getter", "think outside the box", "synergy"
    ]
    for phrase in weak_phrases:
        findings["weak_phrases_count"] += len(re.findall(re.escape(phrase), text_lower))
    
    findings["word_count"] = len(resume_text.split())
    
    score = 0
    
    contact_score = 0
    if findings["has_email"]: contact_score += 8
    if findings["has_phone"]: contact_score += 7
    if findings["has_linkedin"]: contact_score += 5
    if findings["has_github"]: contact_score += 5
    score += min(contact_score, 20)
    
    if findings["has_summary"]: score += 10
    if findings["has_education"]: score += 15
    if findings["has_experience"]: score += 20
    if findings["has_skills"]: score += 10
    
    if findings["has_projects"]: score += 5
    if findings["has_certifications"]: score += 5
    if findings["has_awards"]: score += 5
    
    if findings["bullet_count"] >= 10: score += 5
    elif findings["bullet_count"] >= 5: score += 3
    elif findings["bullet_count"] >= 1: score += 1
    
    if findings["quantified_achievements"] >= 5: score += 5
    elif findings["quantified_achievements"] >= 2: score += 3
    elif findings["quantified_achievements"] >= 1: score += 1
    
    score -= min(findings["weak_phrases_count"] * 2, 10)
    
    score = max(0, min(100, score))
    
    return score, findings


def clean_json_response(text: str) -> str:
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
    
    rule_score, findings = rule_based_analysis(resume_text)
    
    detected_elements = []
    missing_elements = []
    
    if findings["has_email"]: detected_elements.append("email")
    else: missing_elements.append("email")
    if findings["has_phone"]: detected_elements.append("phone")
    else: missing_elements.append("phone")
    if findings["has_linkedin"]: detected_elements.append("LinkedIn")
    if findings["has_github"]: detected_elements.append("GitHub")
    if findings["has_summary"]: detected_elements.append("summary/objective")
    else: missing_elements.append("summary/objective")
    if findings["has_education"]: detected_elements.append("education section")
    else: missing_elements.append("education section")
    if findings["has_experience"]: detected_elements.append("experience section")
    else: missing_elements.append("experience section")
    if findings["has_skills"]: detected_elements.append("skills section")
    else: missing_elements.append("skills section")
    if findings["has_projects"]: detected_elements.append("projects")
    if findings["has_certifications"]: detected_elements.append("certifications")
    if findings["has_awards"]: detected_elements.append("awards/honors")
    
    findings_summary = f"""
PRE-ANALYSIS FINDINGS (verified by objective detection):
- Detected elements: {', '.join(detected_elements) if detected_elements else 'None'}
- Missing elements: {', '.join(missing_elements) if missing_elements else 'None'}
- Bullet points found: {findings['bullet_count']}
- Quantified achievements (numbers/metrics): {findings['quantified_achievements']}
- Strong action verbs used: {findings['action_verbs_count']}
- Weak/overused phrases detected: {findings['weak_phrases_count']}
- Word count: {findings['word_count']}
"""
    
    prompt = f"""You are a brutally honest resume expert and career coach. Act as a recruiter reviewing this resume - be direct about weaknesses.

IMPORTANT: The current year is {current_year}. When calculating years of experience:
- If someone worked from 2021 to Present/{current_year}, that is {current_year - 2021} years
- If dates say "to Present" or "to Current", use {current_year} as the end year
- Calculate experience accurately based on actual start and end dates

{findings_summary}

RESUME TEXT:
{resume_text}

SCORING GUIDELINES - Use the FULL range based on actual quality:
- 90-100: Exceptional resume - has everything, strong metrics, excellent formatting, ready for senior roles
- 80-89: Very strong resume - comprehensive with good metrics, minor improvements possible
- 70-79: Good resume - solid foundation but missing some elements or metrics
- 60-69: Adequate resume - has basics but needs significant improvement in metrics/content
- 50-59: Below average - missing key sections or has major quality issues
- 40-49: Poor resume - multiple missing sections, vague content, weak presentation
- 0-39: Severely lacking - barely qualifies as a resume, major overhaul needed

Evaluate the resume across these dimensions:

1. COMPLETENESS SCORE (0-100):
   - Base your score on the PRE-ANALYSIS FINDINGS above
   - A resume missing email, phone, experience, OR education should score below 60
   - A resume with few quantified achievements and many weak phrases should score below 70
   - Only score above 85 if the resume has comprehensive sections, strong metrics, and few weaknesses
   - Provide a brutally honest rationale

2. SECTION QUALITY SCORES (0-5 each):
   - Summary: Quality and impact of professional summary/objective (0 if missing)
   - Education: Completeness and presentation of educational background (0 if missing)
   - Experience: Depth, relevance, and presentation of work history (0 if missing)
   - Other: Projects, volunteering, awards, skills, certifications

3. IMPROVEMENT SUGGESTIONS (BE BRUTALLY HONEST):
   - Provide 5-8 specific, actionable suggestions
   - Call out overused buzzwords
   - Identify vague statements lacking metrics
   - Flag weak action verbs
   - Point out where quantifiable results are missing
   - DO NOT invent or suggest specific numbers

Return ONLY valid JSON:
{{"completenessScore": <your_score>, "completenessRationale": "...", "sectionScores": {{"summary": <0-5>, "education": <0-5>, "experience": <0-5>, "other": <0-5>}}, "suggestions": ["...", "..."]}}"""

    try:
        response = model.generate_content(prompt)
        text = clean_json_response(response.text)
        data = json.loads(text)
        
        ai_score = min(100, max(0, data.get("completenessScore", 0)))
        
        combined_score = int((rule_score * 0.4) + (ai_score * 0.6))
        combined_score = max(0, min(100, combined_score))
        
        ai_rationale = data.get("completenessRationale", "No rationale provided")
        
        return {
            "completenessScore": combined_score,
            "completenessRationale": ai_rationale,
            "sectionScores": {
                "summary": min(5, max(0, data.get("sectionScores", {}).get("summary", 0))),
                "education": min(5, max(0, data.get("sectionScores", {}).get("education", 0))),
                "experience": min(5, max(0, data.get("sectionScores", {}).get("experience", 0))),
                "other": min(5, max(0, data.get("sectionScores", {}).get("other", 0))),
            },
            "suggestions": data.get("suggestions", [])[:8],
            "ruleBasedFindings": findings
        }
    except Exception as e:
        raise ValueError(f"Failed to analyze resume: {str(e)}")


def extract_job_keywords(job_description: str) -> Dict[str, List[str]]:
    """
    Extract important keywords and requirements from job description.
    Returns categorized keywords for matching analysis.
    """
    text_lower = job_description.lower()
    
    tech_skills = []
    soft_skills = []
    requirements = []
    tools = []
    
    common_tech = [
        "python", "java", "javascript", "typescript", "c++", "c#", "ruby", "go", "rust", "scala",
        "sql", "nosql", "mongodb", "postgresql", "mysql", "redis", "elasticsearch",
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
        "react", "angular", "vue", "node.js", "django", "flask", "spring",
        "machine learning", "deep learning", "nlp", "computer vision", "ai",
        "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy",
        "git", "ci/cd", "jenkins", "github actions", "gitlab",
        "rest api", "graphql", "microservices", "agile", "scrum",
        "data analysis", "data science", "data engineering", "etl",
        "linux", "unix", "bash", "shell scripting"
    ]
    
    for skill in common_tech:
        if skill in text_lower:
            tech_skills.append(skill)
    
    common_soft = [
        "communication", "leadership", "teamwork", "problem-solving", "analytical",
        "collaboration", "project management", "time management", "critical thinking",
        "attention to detail", "creativity", "adaptability", "mentoring"
    ]
    
    for skill in common_soft:
        if skill in text_lower:
            soft_skills.append(skill)
    
    experience_patterns = [
        r'(\d+)\+?\s*years?\s+(?:of\s+)?experience',
        r'(\d+)\+?\s*years?\s+(?:in|with)',
        r'minimum\s+(\d+)\s+years?',
        r'at\s+least\s+(\d+)\s+years?'
    ]
    for pattern in experience_patterns:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            requirements.append(f"{match}+ years experience")
    
    degree_patterns = ["bachelor", "master", "phd", "ph.d", "doctorate", "mba", "bs", "ms", "b.s.", "m.s."]
    for degree in degree_patterns:
        if degree in text_lower:
            requirements.append(f"{degree} degree")
    
    return {
        "tech_skills": list(set(tech_skills)),
        "soft_skills": list(set(soft_skills)),
        "requirements": list(set(requirements)),
        "tools": list(set(tools))
    }


def keyword_match_analysis(resume_text: str, job_keywords: Dict[str, List[str]]) -> Dict[str, Any]:
    """
    Check how many job keywords are present in the resume.
    Returns match statistics and missing keywords.
    """
    resume_lower = resume_text.lower()
    
    results = {
        "tech_skills": {"matched": [], "missing": []},
        "soft_skills": {"matched": [], "missing": []},
        "requirements": {"matched": [], "missing": []},
        "overall_match_rate": 0,
        "total_keywords": 0,
        "matched_count": 0
    }
    
    total = 0
    matched = 0
    
    for skill in job_keywords.get("tech_skills", []):
        total += 1
        if skill in resume_lower:
            results["tech_skills"]["matched"].append(skill)
            matched += 1
        else:
            results["tech_skills"]["missing"].append(skill)
    
    for skill in job_keywords.get("soft_skills", []):
        total += 1
        if skill in resume_lower:
            results["soft_skills"]["matched"].append(skill)
            matched += 1
        else:
            results["soft_skills"]["missing"].append(skill)
    
    for req in job_keywords.get("requirements", []):
        total += 1
        req_parts = req.lower().split()
        if any(part in resume_lower for part in req_parts if len(part) > 3):
            results["requirements"]["matched"].append(req)
            matched += 1
        else:
            results["requirements"]["missing"].append(req)
    
    results["total_keywords"] = total
    results["matched_count"] = matched
    results["overall_match_rate"] = int((matched / total * 100) if total > 0 else 0)
    
    return results


def analyze_job_match(resume_text: str, job_description: str) -> Dict[str, Any]:
    job_keywords = extract_job_keywords(job_description)
    keyword_results = keyword_match_analysis(resume_text, job_keywords)
    
    keyword_summary = f"""
KEYWORD ANALYSIS (objective detection):
- Technical Skills Found: {len(keyword_results['tech_skills']['matched'])} of {len(job_keywords['tech_skills'])}
  - Matched: {', '.join(keyword_results['tech_skills']['matched']) if keyword_results['tech_skills']['matched'] else 'None'}
  - Missing: {', '.join(keyword_results['tech_skills']['missing']) if keyword_results['tech_skills']['missing'] else 'None'}
- Soft Skills Found: {len(keyword_results['soft_skills']['matched'])} of {len(job_keywords['soft_skills'])}
  - Matched: {', '.join(keyword_results['soft_skills']['matched']) if keyword_results['soft_skills']['matched'] else 'None'}
  - Missing: {', '.join(keyword_results['soft_skills']['missing']) if keyword_results['soft_skills']['missing'] else 'None'}
- Requirements: {len(keyword_results['requirements']['matched'])} of {len(job_keywords['requirements'])}
  - Matched: {', '.join(keyword_results['requirements']['matched']) if keyword_results['requirements']['matched'] else 'None'}
  - Missing: {', '.join(keyword_results['requirements']['missing']) if keyword_results['requirements']['missing'] else 'None'}
- Overall Keyword Match Rate: {keyword_results['overall_match_rate']}%
"""
    
    prompt = f"""You are a senior technical recruiter and career coach. Analyze how well this resume aligns with the job description using BOTH semantic understanding AND the keyword analysis provided.

{keyword_summary}

RESUME TEXT:
{resume_text}

JOB DESCRIPTION:
{job_description}

SCORING GUIDELINES - Use the FULL range based on actual fit:
- 90-100: Exceptional match - meets/exceeds all requirements, has all key skills, strong relevant experience
- 80-89: Strong match - meets most requirements, has most key skills, good relevant experience
- 70-79: Good match - meets core requirements but missing some preferred skills
- 60-69: Moderate match - meets some requirements, has transferable skills, needs upskilling
- 50-59: Partial match - has foundational skills but significant gaps exist
- 40-49: Weak match - limited overlap, would need substantial development
- 0-39: Poor match - candidate lacks most required qualifications

ANALYSIS REQUIREMENTS:
1. ALIGNMENT SCORE: Consider both keyword matches AND semantic fit (years experience, domain knowledge, career trajectory)
2. GAPS: Identify 3-8 specific gaps with severity levels
   - HIGH: Missing must-have requirements or core technical skills
   - MEDIUM: Missing preferred qualifications or secondary skills  
   - LOW: Minor gaps or nice-to-have skills not present
3. STRENGTHS: 3-6 specific areas where resume strongly matches job
4. RECOMMENDATIONS: 5-8 actionable steps to improve candidacy

Return ONLY valid JSON:
{{"alignmentScore": <your_score>, "alignmentRationale": "...", "gaps": [{{"category": "...", "description": "...", "severity": "high|medium|low"}}], "strengths": ["..."], "recommendations": ["..."]}}"""

    try:
        response = model.generate_content(prompt)
        text = clean_json_response(response.text)
        data = json.loads(text)
        
        ai_score = min(100, max(0, data.get("alignmentScore", 0)))
        keyword_score = keyword_results["overall_match_rate"]
        
        combined_score = int((keyword_score * 0.3) + (ai_score * 0.7))
        combined_score = max(0, min(100, combined_score))
        
        return {
            "alignmentScore": combined_score,
            "alignmentRationale": data.get("alignmentRationale", "No rationale provided"),
            "gaps": data.get("gaps", [])[:8],
            "strengths": data.get("strengths", [])[:6],
            "recommendations": data.get("recommendations", [])[:8],
            "keywordAnalysis": keyword_results
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
