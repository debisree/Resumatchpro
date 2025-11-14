# ResuMatch Pro

## Overview

ResuMatch Pro is an AI-powered resume analysis and job matching web application that helps users evaluate and improve their resumes and match them against job opportunities. The application allows users to upload resumes in various formats (PDF, DOCX, images), extracts text content, and uses Google Gemini AI to provide:
1. **Resume Analysis**: Comprehensive completeness scores, section-by-section ratings, and actionable improvement suggestions
2. **Job Matching**: Alignment scores (0-100%), gap analysis, strengths identification, and tailored recommendations by comparing resumes against either custom job descriptions or curated role+location combinations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**Routing**: Client-side routing using Wouter for lightweight navigation

**UI Components**: shadcn/ui component library built on Radix UI primitives with Tailwind CSS styling following a "New York" design system

**State Management**: 
- TanStack Query (React Query) for server state management and caching
- React hooks for local component state
- Session-based authentication state managed through API queries

**Design System**:
- Typography: Inter font family via Google Fonts
- Styling: Tailwind CSS with custom theme configuration including design tokens for colors, spacing, and border radius
- Component pattern: Follows shadcn/ui's composable component architecture with variant-based styling using class-variance-authority

**Key Pages**:
- Landing page with simple username-based login
- Dashboard for resume upload and management (limited to show only most recent resume)
- Resume analysis results page displaying AI analysis with progress bar and tabbed sections
- Job match input page with two modes: custom job description or curated role+location selection
- Job match results page displaying alignment scores, strengths, gaps (with severity levels), and recommendations

**Navigation**:
- Sidebar navigation with links to Dashboard and Job Match Analysis pages
- Available on all authenticated pages except landing

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js

**API Design**: RESTful API with routes organized by resource:
- `/api/auth/*` - Authentication endpoints
- `/api/resumes/*` - Resume upload and retrieval
- `/api/analyses/*` - Resume analysis creation and retrieval
- `/api/job-matches/*` - Job match analysis creation and retrieval

**Session Management**: Express-session middleware with cookie-based sessions (no password authentication in current implementation)

**File Processing Pipeline**:
1. Multer middleware for multipart form data handling (10MB file size limit)
2. Memory storage strategy (files stored in buffer, not disk)
3. Format-specific text extraction based on MIME type:
   - PDF: pdf-parse library
   - DOCX: mammoth library
   - Images: Tesseract.js for OCR

**AI Integration**: Google Gemini AI via `@google/genai` SDK with structured JSON schema output for both resume analysis and job matching

**Resume Analysis Data Flow**:
1. User uploads file → Multer processes multipart data
2. Text extraction based on file type
3. Extracted text stored with resume metadata
4. Analysis triggered via separate endpoint
5. Gemini processes text and returns structured analysis
6. Results stored and returned to client

**Job Matching Data Flow** (Interactive Two-Step Process):
1. **Initial Analysis**: User provides either custom job description OR selects role + location from curated lists
2. If role+location selected, Gemini generates a tailored job description
3. User's most recent resume text is retrieved
4. Gemini analyzes resume against job requirements using semantic matching
5. AI returns alignment score (0-100%), strengths, categorized gaps (with severity levels)
6. Initial results stored in database
7. **Interactive Gap Assessment**: User provides proficiency level (None/Basic/Moderate/Advanced) for each identified gap
8. Gemini generates final verdict based on gap responses, providing positive apply/don't apply recommendation
9. Final verdict stored in database
10. **Tailored Resume Generation** (Optional): User can request AI-generated tailored resume optimized for ATS
11. Gemini creates resume with:
    - "CHANGES MADE" section showing what was modified
    - Skills section placed RIGHT AFTER Professional Summary
    - ALL original sections preserved (Volunteering, Awards, Certifications, etc.)
    - All contact links maintained (email, phone, LinkedIn, GitHub, portfolio)
    - Gap proficiency responses integrated (emphasizes skills where user has Basic/Moderate/Advanced proficiency)
    - No hallucinations - only uses real information from original resume
12. Resume content stored in database and downloaded as PDF file via client-side generation

### Data Storage

**Current Implementation**: PostgreSQL database via Neon serverless with Drizzle ORM

**Migration History**: 
- November 12, 2025: Migrated from in-memory (MemStorage) to PostgreSQL persistence
- All data (users, resumes, analyses) now persisted in Neon database
- DbStorage class implements IStorage interface with full Drizzle ORM CRUD operations
- Fallback to MemStorage available when DATABASE_URL not present

**Database Schema**:

**Users Table**:
- id (UUID primary key)
- username (text, unique)

**Resumes Table**:
- id (UUID primary key)
- userId (foreign key to users)
- filename (text)
- filesize (integer)
- mimeType (text)
- extractedText (text)
- createdAt (timestamp)

**Analyses Table**:
- id (UUID primary key)
- resumeId (foreign key to resumes)
- completenessScore (integer 0-100)
- completenessRationale (text)
- sectionScores (JSONB object with summary, education, experience, other fields rated 0-5)
- suggestions (JSONB array of strings)
- createdAt (timestamp)

**JobMatches Table**:
- id (UUID primary key)
- resumeId (foreign key to resumes)
- jobDescription (text) - stores custom JD or AI-generated JD from role+location
- jobRole (text, nullable) - selected role if using curated mode
- jobLocation (text, nullable) - selected location if using curated mode
- alignmentScore (integer 0-100) - semantic matching score
- alignmentRationale (text) - AI explanation of score
- strengths (JSONB array of strings) - resume strengths for this job
- gaps (JSONB array of objects with category, description, severity fields) - missing qualifications
- gapResponses (JSONB array, nullable) - user's proficiency responses for each gap
- finalVerdict (text, nullable) - AI-generated recommendation on whether to apply
- shouldApply (boolean, nullable) - AI's positive apply/don't apply decision
- tailoredResumeContent (text, nullable) - AI-generated tailored resume content
- createdAt (timestamp)

**Storage Interface**: IStorage interface defines contract for data operations, allowing easy migration from in-memory to PostgreSQL using Drizzle ORM

### External Dependencies

**AI Service**: 
- Google Gemini AI (gemini-1.5-flash model)
- Environment variables: `AI_INTEGRATIONS_GEMINI_API_KEY` and `AI_INTEGRATIONS_GEMINI_BASE_URL`
- Structured output with defined schema for consistent analysis format

**Database** (Active):
- PostgreSQL via Neon serverless (@neondatabase/serverless) with WebSocket support (ws library)
- Drizzle ORM for type-safe database operations with full CRUD implementation
- Connection string via `DATABASE_URL` environment variable
- Schema pushed to database via `npm run db:push`
- DbStorage class handles all persistence with automatic ID/timestamp generation

**File Processing Libraries**:
- pdf-parse: PDF text extraction (uses module.default export)
- mammoth: DOCX text extraction
- tesseract.js: OCR for image-based resumes
- Supported formats: PDF, DOCX, PNG, JPG, TXT (plain text)

**Development Tools**:
- Replit-specific plugins for development banner, error overlay, and cartographer
- ESBuild for server bundling in production
- Vite dev server with HMR in development

**Session Storage**:
- Express-session with configurable secret (`SESSION_SECRET` environment variable)
- Cookie-based sessions with 7-day expiration
- Prepared for PostgreSQL session store via connect-pg-simple (installed but not configured)

**UI Libraries**:
- Radix UI primitives for accessible component foundations
- Tailwind CSS for utility-first styling
- Lucide React for icons
- React Hook Form with Zod validation (@hookform/resolvers)

**Document Generation**:
- pdfmake library for client-side PDF resume generation
- Virtual File System (VFS) for embedded fonts using addVirtualFileSystem() method
- Native PDF formatting (no markdown syntax in output):
  - **Bold text**: `**text**` parsed to pdfMake bold format (actual bold, not asterisks)
  - **Bullets**: `- item` or `* item` rendered as pdfMake `ul` structure (actual bullet glyphs •, not asterisks)
  - **Links**: `[text](url)` converted to clickable hyperlinks with blue color and underline
- Inline formatting parser handles mixed content (e.g., "Worked on **Docker** and **Kubernetes**" renders with bold words)
- ATS-friendly output with consistent styling and professional typography