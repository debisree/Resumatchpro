# ResuMatch Pro

An AI-powered resume analysis and job matching web application that helps users evaluate and improve their resumes, match them against job opportunities, and plan their career roadmap.

## 🚀 Features

### 1. **Resume Analysis**
- Upload resumes in multiple formats (PDF, DOCX, images via OCR)
- AI-powered completeness scoring (0-100%)
- Section-by-section quality ratings (Summary, Education, Experience, Other)
- Brutally honest, actionable improvement suggestions
- Zero-hallucination policy: AI suggests improvements without inventing fake metrics

### 2. **Job Matching**
- Two modes: Custom job description OR curated role + location selection
- AI generates tailored job descriptions for role/location combinations
- Semantic alignment scoring (0-100%)
- Gap analysis with severity levels (High/Medium/Low)
- Interactive gap assessment: Rate your proficiency (None/Basic/Moderate/Advanced)
- Final AI verdict on whether to apply

### 3. **Tailored Resume Generation**
- ATS-optimized resumes customized for specific jobs
- Preserves all original sections (Volunteering, Awards, Certifications, etc.)
- Maintains all contact links (LinkedIn, GitHub, Google Scholar, etc.)
- Integrates user-confirmed skills from gap assessment
- Results-driven language enhancement (strong action verbs, impact-oriented)
- PDF download with dynamic filename: `{UserName}_tailored resume.pdf`

### 4. **Career Roadmap**
- Personalized career development plans
- Input: Dream role, location, timeframe (6 months to 2 years)
- AI analyzes current gaps vs. target role
- Phased action plans with specific steps
- Resource recommendations (courses, certifications, books)
- Milestone tracking

## 🏗️ Architecture

### **Backend** (Python Migration in Progress)
- **Framework**: FastAPI (async, high-performance)
- **Database**: PostgreSQL via SQLAlchemy ORM
- **Authentication**: Password-based with bcrypt hashing
- **AI Integration**: Google Gemini AI (gemini-2.0-flash-exp model)
- **File Processing**: 
  - PDF: PyPDF2
  - DOCX: python-docx
  - Images: Tesseract.js OCR
  - Max upload: 10MB

### **Frontend** (React - Unchanged)
- **Framework**: React + TypeScript + Vite
- **UI**: shadcn/ui components + Tailwind CSS
- **State**: TanStack Query (React Query)
- **Routing**: Wouter
- **PDF Generation**: pdfmake (client-side)

### **Database Schema**
```
users
├── id (UUID)
├── username
└── password_hash

resumes
├── id (UUID)
├── user_id (FK → users)
├── filename
├── filesize
├── mime_type
├── extracted_text
└── created_at

analyses
├── id (UUID)
├── resume_id (FK → resumes)
├── completeness_score (0-100)
├── completeness_rationale
├── section_scores (JSON)
├── suggestions (JSON array)
└── created_at

job_matches
├── id (UUID)
├── resume_id (FK → resumes)
├── job_description
├── job_role (nullable)
├── job_location (nullable)
├── alignment_score (0-100)
├── alignment_rationale
├── gaps (JSON array)
├── strengths (JSON array)
├── gap_responses (JSON array)
├── final_verdict
├── should_apply (boolean)
├── tailored_resume_content
└── created_at

career_roadmaps
├── id (UUID)
├── user_id (FK → users)
├── resume_id (FK → resumes)
├── dream_role
├── dream_location
├── timeframe
├── current_gaps (JSON array)
├── skills_to_acquire (JSON array)
├── action_plan (JSON array)
├── resources (JSON array)
├── milestones (JSON array)
└── created_at
```

## 🔧 Setup & Installation

### Prerequisites
- Python 3.11+
- PostgreSQL database
- Gemini API key

### Environment Variables
Create a `.env` file with:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-secret-key-change-in-production
GEMINI_API_KEY=your-gemini-api-key
```

### Installation

1. **Install Python dependencies**:
```bash
pip install -r python_requirements.txt
```

Or on Replit, packages are auto-installed.

2. **Set up database**:
The application will auto-create tables on first run using SQLAlchemy.

3. **Run the application**:
```bash
# Development mode
uvicorn python_backend.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn python_backend.main:app --host 0.0.0.0 --port 8000
```

4. **Build React frontend** (if needed):
```bash
npm install
npm run build
```

## 📁 Project Structure

```
resumatch-pro/
├── python_backend/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Configuration & environment variables
│   ├── models.py            # SQLAlchemy database models
│   ├── database.py          # Database session management
│   ├── auth.py              # Authentication utilities
│   ├── file_processor.py    # File upload & text extraction
│   ├── gemini_service.py    # Gemini AI integration
│   └── routes/              # API route handlers (to be created)
│       ├── auth.py
│       ├── resumes.py
│       ├── analyses.py
│       ├── job_matches.py
│       └── career_roadmaps.py
├── client/
│   └── src/
│       ├── App.tsx          # React app & routing
│       ├── pages/           # Page components
│       ├── components/      # Reusable UI components
│       └── lib/             # Utilities & API client
├── attached_assets/         # User-uploaded files & generated content
├── python_requirements.txt  # Python dependencies
├── package.json             # Node.js dependencies
└── README.md
```

## 🔐 Authentication

- **Username + Password** authentication
- Passwords hashed with bcrypt (cost factor 12)
- Session-based authentication with secure cookies
- Registration endpoint: `POST /api/auth/register`
- Login endpoint: `POST /api/auth/login`
- Logout endpoint: `POST /api/auth/logout`

## 🤖 AI Integration

### Gemini AI Features
- **Model**: gemini-2.0-flash-exp (latest Flash model)
- **Structured Output**: JSON schema enforcement
- **Zero-Hallucination Policy**: Never invents metrics or data
- **Brutally Honest Feedback**: Identifies weak language, buzzwords, missing metrics
- **Results-Driven Language**: Transforms passive statements into impact-oriented achievements

### API Endpoints (Planned)

#### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

#### Resumes
- `POST /api/resumes` - Upload resume (multipart/form-data)
- `GET /api/resumes` - Get user's resumes
- `GET /api/resumes/{id}` - Get specific resume

#### Analyses
- `POST /api/analyses` - Analyze a resume
- `GET /api/analyses/{resume_id}` - Get analysis for resume

#### Job Matches
- `POST /api/job-matches` - Create job match analysis
- `GET /api/job-matches/{resume_id}` - Get job matches for resume
- `PATCH /api/job-matches/{id}/responses` - Submit gap proficiency responses
- `POST /api/job-matches/{id}/tailored-resume` - Generate tailored resume

#### Career Roadmaps
- `POST /api/career-roadmaps` - Generate career roadmap
- `GET /api/career-roadmaps` - Get user's career roadmaps

## 🎨 Frontend Pages

- **Landing Page**: Simple username/password login
- **Dashboard**: Resume upload and management
- **Resume Analysis**: AI analysis results with scores and suggestions
- **Job Match Input**: Custom JD or role+location selection
- **Job Match Results**: Alignment scores, gaps, strengths, recommendations
- **Career Roadmap**: Dream role form and career guidance

## 📝 Migration Notes

### From Node.js to Python
- ✅ SQLAlchemy models match existing PostgreSQL schema
- ✅ UUID primary keys preserved
- ✅ All JSONB columns supported
- ✅ Authentication upgraded from username-only to username+password
- ✅ Gemini AI service ported with identical prompts
- ✅ File processing pipeline (PDF, DOCX, OCR) reimplemented
- 🚧 FastAPI routes in progress
- 🚧 Session management setup
- 🚧 React frontend integration

### Database Compatibility
- Existing data preserved (users, resumes, analyses, job_matches, career_roadmaps)
- Schema unchanged - seamless migration
- Add `password_hash` column to `users` table for existing users

## 🧪 Testing

(To be implemented)
- Unit tests for AI service
- Integration tests for API endpoints
- E2E tests with Playwright

## 🚢 Deployment

The application is designed to run on Replit with:
- Auto-managed PostgreSQL database
- Environment secrets management
- One-click deployment

## 📄 License

Proprietary - All rights reserved

## 🤝 Contributing

This is a private project. Contact the owner for collaboration opportunities.

## 📞 Support

For issues or questions, please contact the project maintainer.

---

**Built with ❤️ using FastAPI, React, and Gemini AI**
