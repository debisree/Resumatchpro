# ResuMatch Pro

## Overview

ResuMatch Pro is an AI-powered resume analysis and job matching web application that helps users evaluate and improve their resumes and match them against job opportunities. The application allows users to upload resumes in various formats (PDF, DOCX, images), extracts text content, and uses Google Gemini AI to provide:
1. **Resume Analysis**: Comprehensive completeness scores, section-by-section ratings, and actionable improvement suggestions
2. **Job Matching**: Alignment scores (0-100%), gap analysis, strengths identification, and tailored recommendations by comparing resumes against either custom job descriptions or curated role+location combinations
3. **Career Roadmap**: Personalized career development plans based on dream role, location, and timeframe (6 months to 2 years), including current gaps analysis, skills to acquire, phased action plans, recommended resources, and milestone tracking

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Simplified Single Flask App (December 2025)

The application uses a simplified single Flask app architecture with server-side rendering using Jinja2 templates. This makes it easy to deploy on VS Code, AWS, or any environment that supports Python.

### Project Structure

```
resumatch-pro/
├── app.py              # Main Flask application with all routes
├── config.py           # Configuration settings (DB, API keys)
├── models.py           # SQLAlchemy database models
├── ai_service.py       # Google Gemini AI integration
├── file_processor.py   # Resume file parsing (PDF, DOCX, images)
├── auth.py             # Password hashing with bcrypt
├── run.py              # Entry point (python run.py)
├── templates/          # Jinja2 HTML templates
│   ├── base.html       # Base template for public pages
│   ├── layout_auth.html # Layout with sidebar for authenticated pages
│   ├── index.html      # Landing page
│   ├── login.html      # Login form
│   ├── register.html   # Registration form
│   ├── dashboard.html  # Home page with resume upload
│   ├── analysis.html   # Resume analysis results
│   ├── job_match.html  # Job match input form
│   ├── job_match_results.html # Job match results with gap assessment
│   ├── career_roadmap.html # Career roadmap input form
│   └── career_roadmap_results.html # Career roadmap display
└── static/             # CSS and assets
```

### Frontend Architecture

**Framework**: Server-side rendered HTML using Jinja2 templates

**Styling**: Tailwind CSS via CDN with custom theme colors

**Navigation**: 
- Sidebar navigation with links to Home, Job Match Analysis, and Career Roadmap
- "Home" replaces "Dashboard" throughout the application

**Key Pages**:
- Landing page with login/register options
- Home page for resume upload and management (shows most recent resume)
- Resume analysis results page with progress bar and section scores
- Job match input page with two modes: custom job description or curated role+location selection
- Job match results page with alignment scores, strengths, gaps, interactive gap assessment, and tailored resume generation
- Career roadmap page with dream role/location form and comprehensive career guidance

### Backend Architecture

**Framework**: Flask with SQLAlchemy ORM

**Routes** (defined in app.py):
- `/` - Landing page (redirects to /home if logged in)
- `/register`, `/login`, `/logout` - Authentication
- `/home` - Home page with resume upload
- `/upload-resume` - Resume file upload (POST)
- `/analyze-resume/<resume_id>` - Trigger AI analysis
- `/analysis/<analysis_id>` - View analysis results
- `/job-match` - Job match input form
- `/job-match/analyze` - Submit job match analysis (POST)
- `/job-match/<match_id>` - View job match results
- `/job-match/<match_id>/submit-gaps` - Submit gap proficiency responses (API)
- `/job-match/<match_id>/generate-resume` - Generate tailored resume (API)
- `/job-match/<match_id>/download-pdf` - Download tailored resume as PDF
- `/career-roadmap` - Career roadmap input form
- `/career-roadmap/generate` - Generate career roadmap (POST)
- `/career-roadmap/<roadmap_id>` - View career roadmap results

**File Processing Pipeline**:
1. Flask handles multipart form data (10MB file size limit)
2. Format-specific text extraction:
   - PDF: PyPDF2 library
   - DOCX: python-docx library
   - Images: pytesseract for OCR
3. Extracted text stored in database with resume metadata

**AI Integration**: 
- Google Gemini AI (gemini-2.0-flash-exp model)
- Uses `google-generativeai` Python SDK
- GEMINI_API_KEY environment variable required
- **Enhanced Prompting Strategy**:
  - Brutally honest resume analysis: identifies overused buzzwords, weak action verbs, missing metrics
  - Results-driven language emphasis: transforms passive statements into impact-oriented achievements
  - **Zero-hallucination policy**: AI enhances language WITHOUT inventing fake numbers or metrics
  - Action verb coaching: promotes "architected", "led", "scaled" over "worked on", "helped with"

**Resume Analysis Data Flow**:
1. User uploads file → Flask processes multipart data
2. Text extraction based on file type
3. Extracted text stored with resume metadata
4. Analysis triggered via separate endpoint
5. Gemini processes text and returns structured JSON
6. Results stored and displayed to user

**Job Matching Data Flow** (Interactive Two-Step Process):
1. User provides either custom job description OR selects role + location from curated lists
2. If role+location selected, Gemini generates a tailored job description
3. User's most recent resume text is retrieved
4. Gemini analyzes resume against job requirements using semantic matching
5. AI returns alignment score (0-100%), strengths, categorized gaps (with severity levels)
6. Initial results stored in database
7. **Interactive Gap Assessment**: User provides proficiency level (None/Basic/Moderate/Advanced) for each identified gap
8. Gemini generates final verdict based on gap responses
9. **Tailored Resume Generation** (Optional): User can request AI-generated tailored resume optimized for ATS
10. Resume downloaded as PDF via server-side ReportLab generation

**Career Roadmap Data Flow**:
1. User fills in dream role, dream location, and selects timeframe (6 months to 2 years)
2. User's most recent resume text is retrieved
3. Gemini analyzes current resume against dream role requirements
4. AI generates comprehensive career guidance including:
   - Current gaps, skills to acquire, action plan, resources, milestones
5. Career roadmap stored in database and displayed to user

### Data Storage

**Database**: PostgreSQL via Neon serverless with SQLAlchemy ORM

**Connection Settings** (for serverless PostgreSQL):
- pool_pre_ping=True
- pool_recycle=300
- pool_size=5, max_overflow=10

**Database Schema**:

**Users Table**:
- id (UUID primary key)
- username (text, unique)
- password_hash (text)

**Resumes Table**:
- id (UUID primary key)
- user_id (foreign key to users)
- filename, filesize, mime_type
- extracted_text
- created_at

**Analyses Table**:
- id (UUID primary key)
- resume_id (foreign key to resumes)
- completeness_score, completeness_rationale
- section_scores (JSON)
- suggestions (JSON)
- created_at

**JobMatches Table**:
- id (UUID primary key)
- resume_id (foreign key to resumes)
- job_description, job_role, job_location
- alignment_score, alignment_rationale
- strengths, gaps (JSON)
- gap_responses (JSON)
- final_verdict, should_apply
- changes_summary, tailored_resume_content
- created_at

**CareerRoadmaps Table**:
- id (UUID primary key)
- user_id, resume_id
- dream_role, dream_location, timeframe
- current_gaps, skills_to_acquire, action_plan, resources, milestones (JSON)
- created_at

### Environment Variables

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `GEMINI_API_KEY` - Google Gemini API key
- `SESSION_SECRET` - Flask session secret key

### Running the Application

```bash
# Install dependencies
pip install flask flask-sqlalchemy python-dotenv google-generativeai bcrypt PyPDF2 python-docx pytesseract Pillow reportlab psycopg2-binary

# Run the app
python app.py
# or
python run.py
```

The app will be available at http://localhost:5000

### PDF Generation

- Uses ReportLab for server-side PDF generation
- JSON schema-first approach for AI→PDF pipeline
- PDF includes:
  - Name at top with proper spacing
  - Contact info line
  - Clickable social links (LinkedIn, GitHub, Kaggle, Medium, Google Scholar)
  - Bold section headers
  - Bullet points for all list items
  - ATS-friendly formatting
