import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Database configuration with fallback to SQLite if DATABASE_URL is not set
    _database_url = os.getenv("DATABASE_URL")
    if not _database_url or _database_url.strip() == "":
        # Fallback to SQLite for development/testing
        # For production, set DATABASE_URL environment variable to PostgreSQL
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resumatch.db')
        DATABASE_URL = f"sqlite:///{db_path}"
        print("WARNING: DATABASE_URL not set. Using SQLite database as fallback.")
        print(f"Database will be created at: {db_path}")
        print("For production, set DATABASE_URL environment variable to your PostgreSQL connection string.")
    else:
        DATABASE_URL = _database_url.strip()
    
    SECRET_KEY = os.getenv("SESSION_SECRET", "your-secret-key-change-in-production")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'png', 'jpg', 'jpeg', 'txt'}
    
    @staticmethod
    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
