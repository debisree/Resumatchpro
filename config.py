import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Default to SQLite for local development if DATABASE_URL is not set
    DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///resumatch.db"
    SECRET_KEY = os.getenv("SESSION_SECRET", "your-secret-key-change-in-production")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'png', 'jpg', 'jpeg', 'txt'}
    
    @staticmethod
    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
