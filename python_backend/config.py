import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL")

# Session
SESSION_SECRET = os.getenv("SESSION_SECRET", "your-secret-key-change-in-production")

# Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# File Upload
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # DOCX
    "image/png",
    "image/jpeg",
    "text/plain",
]
