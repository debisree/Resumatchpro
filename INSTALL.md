# ResuMatch Pro - Installation Guide

## Requirements

Install the following Python packages:

```bash
pip install flask flask-sqlalchemy python-dotenv google-generativeai bcrypt PyPDF2 python-docx pytesseract Pillow reportlab psycopg2-binary
```

## Environment Variables

Create a `.env` file in the project root:

```
DATABASE_URL=postgresql://username:password@localhost:5432/resumatch
GEMINI_API_KEY=your_gemini_api_key_here
SESSION_SECRET=any_random_secret_string
```

## Running the App

```bash
python app.py
```

The app will be available at http://localhost:5000

## Project Structure

```
resumatch-pro/
├── app.py              # Main Flask application
├── config.py           # Configuration settings
├── models.py           # Database models
├── ai_service.py       # Gemini AI integration
├── file_processor.py   # Resume file parsing
├── auth.py             # Password hashing
├── templates/          # HTML templates
└── static/             # CSS and assets
```
