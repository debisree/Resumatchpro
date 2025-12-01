from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    
    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    career_roadmaps = relationship("CareerRoadmap", back_populates="user", cascade="all, delete-orphan")

class Resume(Base):
    __tablename__ = "resumes"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    filename = Column(Text, nullable=False)
    filesize = Column(Integer, nullable=False)
    mime_type = Column(Text, nullable=False)
    extracted_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="resumes")
    analyses = relationship("Analysis", back_populates="resume", cascade="all, delete-orphan")
    job_matches = relationship("JobMatch", back_populates="resume", cascade="all, delete-orphan")
    career_roadmaps = relationship("CareerRoadmap", back_populates="resume", cascade="all, delete-orphan")

class Analysis(Base):
    __tablename__ = "analyses"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=False)
    completeness_score = Column(Integer, nullable=False)
    completeness_rationale = Column(Text, nullable=False)
    section_scores = Column(JSON, nullable=False)
    suggestions = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    resume = relationship("Resume", back_populates="analyses")

class JobMatch(Base):
    __tablename__ = "job_matches"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=False)
    job_description = Column(Text, nullable=False)
    job_role = Column(Text, nullable=True)
    job_location = Column(Text, nullable=True)
    alignment_score = Column(Integer, nullable=False)
    alignment_rationale = Column(Text, nullable=False)
    gaps = Column(JSON, nullable=False)
    strengths = Column(JSON, nullable=False)
    gap_responses = Column(JSON, nullable=True)
    final_verdict = Column(Text, nullable=True)
    should_apply = Column(Boolean, nullable=True)
    changes_summary = Column(Text, nullable=True)
    tailored_resume_content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    resume = relationship("Resume", back_populates="job_matches")

class CareerRoadmap(Base):
    __tablename__ = "career_roadmaps"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    resume_id = Column(String, ForeignKey("resumes.id"), nullable=False)
    dream_role = Column(Text, nullable=False)
    dream_location = Column(Text, nullable=False)
    timeframe = Column(Text, nullable=False)
    current_gaps = Column(JSON, nullable=False)
    skills_to_acquire = Column(JSON, nullable=False)
    action_plan = Column(JSON, nullable=False)
    resources = Column(JSON, nullable=False)
    milestones = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="career_roadmaps")
    resume = relationship("Resume", back_populates="career_roadmaps")
