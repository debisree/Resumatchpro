from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid

db = SQLAlchemy()

def generate_uuid():
    return str(uuid.uuid4())

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    username = db.Column(db.Text, unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=True)
    
    resumes = db.relationship('Resume', backref='user', lazy=True, cascade='all, delete-orphan')
    career_roadmaps = db.relationship('CareerRoadmap', backref='user', lazy=True, cascade='all, delete-orphan')

class Resume(db.Model):
    __tablename__ = 'resumes'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.Text, nullable=False)
    filesize = db.Column(db.Integer, nullable=False)
    mime_type = db.Column(db.Text, nullable=False)
    extracted_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    analyses = db.relationship('Analysis', backref='resume', lazy=True, cascade='all, delete-orphan')
    job_matches = db.relationship('JobMatch', backref='resume', lazy=True, cascade='all, delete-orphan')

class Analysis(db.Model):
    __tablename__ = 'analyses'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    resume_id = db.Column(db.String(36), db.ForeignKey('resumes.id'), nullable=False)
    completeness_score = db.Column(db.Integer, nullable=False)
    completeness_rationale = db.Column(db.Text, nullable=False)
    section_scores = db.Column(db.JSON, nullable=False)
    suggestions = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class JobMatch(db.Model):
    __tablename__ = 'job_matches'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    resume_id = db.Column(db.String(36), db.ForeignKey('resumes.id'), nullable=False)
    job_description = db.Column(db.Text, nullable=False)
    job_role = db.Column(db.Text, nullable=True)
    job_location = db.Column(db.Text, nullable=True)
    alignment_score = db.Column(db.Integer, nullable=False)
    alignment_rationale = db.Column(db.Text, nullable=False)
    gaps = db.Column(db.JSON, nullable=False)
    strengths = db.Column(db.JSON, nullable=False)
    gap_responses = db.Column(db.JSON, nullable=True)
    final_verdict = db.Column(db.Text, nullable=True)
    should_apply = db.Column(db.Boolean, nullable=True)
    changes_summary = db.Column(db.Text, nullable=True)
    tailored_resume_content = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class CareerRoadmap(db.Model):
    __tablename__ = 'career_roadmaps'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    resume_id = db.Column(db.String(36), db.ForeignKey('resumes.id'), nullable=False)
    dream_role = db.Column(db.Text, nullable=False)
    dream_location = db.Column(db.Text, nullable=False)
    timeframe = db.Column(db.Text, nullable=False)
    current_gaps = db.Column(db.JSON, nullable=False)
    skills_to_acquire = db.Column(db.JSON, nullable=False)
    action_plan = db.Column(db.JSON, nullable=False)
    resources = db.Column(db.JSON, nullable=False)
    milestones = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
