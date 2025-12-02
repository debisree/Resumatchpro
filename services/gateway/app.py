from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, send_file
from functools import wraps
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.models import db, User, Resume, Analysis, JobMatch, CareerRoadmap
from shared.config import Config
from auth_service.auth import hash_password, verify_password
from resume_service.file_processor import extract_text_from_file, get_mime_type
from ai_service.gemini import (
    analyze_resume,
    analyze_job_match,
    generate_job_description,
    generate_final_verdict,
    generate_tailored_resume,
    generate_career_roadmap
)

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib import colors
import io
import re


def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = Config.SECRET_KEY
    app.config['SQLALCHEMY_DATABASE_URI'] = Config.DATABASE_URL
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['MAX_CONTENT_LENGTH'] = Config.MAX_UPLOAD_SIZE
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_size': 5,
        'max_overflow': 10,
    }
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
    
    return app


app = create_app()


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    if 'user_id' in session:
        return User.query.get(session['user_id'])
    return None


@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        if not username or not password:
            flash('Username and password are required.', 'error')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('register.html')
        
        if len(password) < 6:
            flash('Password must be at least 6 characters.', 'error')
            return render_template('register.html')
        
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already exists.', 'error')
            return render_template('register.html')
        
        user = User(username=username, password_hash=hash_password(password))
        db.session.add(user)
        db.session.commit()
        
        session['user_id'] = user.id
        flash('Account created successfully!', 'success')
        return redirect(url_for('dashboard'))
    
    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        user = User.query.filter_by(username=username).first()
        
        if user and verify_password(password, user.password_hash):
            session['user_id'] = user.id
            flash('Logged in successfully!', 'success')
            return redirect(url_for('dashboard'))
        
        flash('Invalid username or password.', 'error')
    
    return render_template('login.html')


@app.route('/logout')
def logout():
    session.pop('user_id', None)
    flash('Logged out successfully.', 'success')
    return redirect(url_for('index'))


@app.route('/dashboard')
@login_required
def dashboard():
    user = get_current_user()
    resumes = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).all()
    latest_resume = resumes[0] if resumes else None
    latest_analysis = None
    if latest_resume:
        latest_analysis = Analysis.query.filter_by(resume_id=latest_resume.id).first()
    return render_template('dashboard.html', user=user, resumes=resumes, 
                         latest_resume=latest_resume, latest_analysis=latest_analysis)


@app.route('/upload-resume', methods=['POST'])
@login_required
def upload_resume():
    user = get_current_user()
    
    if 'file' not in request.files:
        flash('No file uploaded.', 'error')
        return redirect(url_for('dashboard'))
    
    file = request.files['file']
    if file.filename == '':
        flash('No file selected.', 'error')
        return redirect(url_for('dashboard'))
    
    if not Config.allowed_file(file.filename):
        flash('Invalid file type. Please upload PDF, DOCX, PNG, JPG, or TXT.', 'error')
        return redirect(url_for('dashboard'))
    
    try:
        file_content = file.read()
        mime_type = get_mime_type(file.filename)
        extracted_text = extract_text_from_file(file_content, mime_type)
        
        if not extracted_text or len(extracted_text.strip()) < 50:
            flash('Could not extract sufficient text from the file.', 'error')
            return redirect(url_for('dashboard'))
        
        resume = Resume(
            user_id=user.id,
            filename=file.filename,
            filesize=len(file_content),
            mime_type=mime_type,
            extracted_text=extracted_text
        )
        db.session.add(resume)
        db.session.commit()
        
        flash('Resume uploaded successfully!', 'success')
        return redirect(url_for('dashboard'))
    
    except Exception as e:
        flash(f'Error processing file: {str(e)}', 'error')
        return redirect(url_for('dashboard'))


@app.route('/analyze-resume/<resume_id>')
@login_required
def analyze_resume_route(resume_id):
    user = get_current_user()
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    
    if not resume:
        flash('Resume not found.', 'error')
        return redirect(url_for('dashboard'))
    
    existing_analysis = Analysis.query.filter_by(resume_id=resume_id).first()
    if existing_analysis:
        return redirect(url_for('analysis_results', analysis_id=existing_analysis.id))
    
    try:
        result = analyze_resume(resume.extracted_text)
        
        analysis = Analysis(
            resume_id=resume_id,
            completeness_score=result['completenessScore'],
            completeness_rationale=result['completenessRationale'],
            section_scores=result['sectionScores'],
            suggestions=result['suggestions']
        )
        db.session.add(analysis)
        db.session.commit()
        
        return redirect(url_for('analysis_results', analysis_id=analysis.id))
    
    except Exception as e:
        flash(f'Error analyzing resume: {str(e)}', 'error')
        return redirect(url_for('dashboard'))


@app.route('/analysis/<analysis_id>')
@login_required
def analysis_results(analysis_id):
    user = get_current_user()
    analysis = Analysis.query.get(analysis_id)
    
    if not analysis:
        flash('Analysis not found.', 'error')
        return redirect(url_for('dashboard'))
    
    resume = Resume.query.get(analysis.resume_id)
    if resume.user_id != user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('dashboard'))
    
    return render_template('analysis.html', analysis=analysis, resume=resume, user=user)


@app.route('/job-match')
@login_required
def job_match():
    user = get_current_user()
    resumes = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).all()
    return render_template('job_match.html', user=user, resumes=resumes)


@app.route('/job-match/analyze', methods=['POST'])
@login_required
def job_match_analyze():
    user = get_current_user()
    
    mode = request.form.get('mode', 'custom')
    job_description = request.form.get('job_description', '')
    job_role = request.form.get('job_role', '')
    job_location = request.form.get('job_location', '')
    
    latest_resume = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).first()
    
    if not latest_resume:
        flash('Please upload a resume first.', 'error')
        return redirect(url_for('job_match'))
    
    try:
        if mode == 'curated' and job_role and job_location:
            job_description = generate_job_description(job_role, job_location)
        
        if not job_description:
            flash('Please provide a job description.', 'error')
            return redirect(url_for('job_match'))
        
        result = analyze_job_match(latest_resume.extracted_text, job_description)
        
        job_match_record = JobMatch(
            resume_id=latest_resume.id,
            job_description=job_description,
            job_role=job_role if mode == 'curated' else None,
            job_location=job_location if mode == 'curated' else None,
            alignment_score=result['alignmentScore'],
            alignment_rationale=result['alignmentRationale'],
            gaps=result['gaps'],
            strengths=result['strengths']
        )
        db.session.add(job_match_record)
        db.session.commit()
        
        return redirect(url_for('job_match_results', match_id=job_match_record.id))
    
    except Exception as e:
        flash(f'Error analyzing job match: {str(e)}', 'error')
        return redirect(url_for('job_match'))


@app.route('/job-match/<match_id>')
@login_required
def job_match_results(match_id):
    user = get_current_user()
    match = JobMatch.query.get(match_id)
    
    if not match:
        flash('Job match not found.', 'error')
        return redirect(url_for('job_match'))
    
    resume = Resume.query.get(match.resume_id)
    if resume.user_id != user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('job_match'))
    
    return render_template('job_match_results.html', match=match, resume=resume, user=user)


@app.route('/job-match/<match_id>/submit-gaps', methods=['POST'])
@login_required
def submit_gap_responses(match_id):
    user = get_current_user()
    match = JobMatch.query.get(match_id)
    
    if not match:
        return jsonify({'error': 'Job match not found'}), 404
    
    resume = Resume.query.get(match.resume_id)
    if resume.user_id != user.id:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        gap_responses = request.json.get('gapResponses', [])
        
        verdict_result = generate_final_verdict(
            resume.extracted_text,
            match.job_description,
            match.alignment_score,
            match.gaps,
            gap_responses
        )
        
        match.gap_responses = gap_responses
        match.final_verdict = verdict_result['verdict']
        match.should_apply = verdict_result['shouldApply']
        db.session.commit()
        
        return jsonify({
            'success': True,
            'finalVerdict': verdict_result['verdict'],
            'shouldApply': verdict_result['shouldApply']
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/job-match/<match_id>/generate-resume', methods=['POST'])
@login_required
def generate_tailored_resume_route(match_id):
    user = get_current_user()
    match = JobMatch.query.get(match_id)
    
    if not match:
        return jsonify({'error': 'Job match not found'}), 404
    
    resume = Resume.query.get(match.resume_id)
    if resume.user_id != user.id:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        result = generate_tailored_resume(
            resume.extracted_text,
            match.job_description,
            match.strengths,
            match.gaps,
            match.gap_responses or []
        )
        
        match.changes_summary = result['changesSummary']
        match.tailored_resume_content = result['resumeMarkdown']
        db.session.commit()
        
        return jsonify({
            'success': True,
            'changesSummary': result['changesSummary'],
            'resumeContent': result['resumeMarkdown']
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/job-match/<match_id>/download-pdf')
@login_required
def download_tailored_resume_pdf(match_id):
    user = get_current_user()
    match = JobMatch.query.get(match_id)
    
    if not match or not match.tailored_resume_content:
        flash('Tailored resume not found.', 'error')
        return redirect(url_for('job_match'))
    
    resume = Resume.query.get(match.resume_id)
    if resume.user_id != user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('job_match'))
    
    user_name = extract_name_from_resume(match.tailored_resume_content)
    filename = f"{user_name}_tailored_resume.pdf"
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=36, bottomMargin=36)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ResumeName', fontSize=16, spaceAfter=2, alignment=1, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='ResumeTitle', fontSize=10, spaceAfter=4, alignment=1, fontName='Helvetica', textColor=colors.HexColor('#555555')))
    styles.add(ParagraphStyle(name='ContactLine', fontSize=9, spaceAfter=2, alignment=1, textColor=colors.HexColor('#333333')))
    styles.add(ParagraphStyle(name='LinksLine', fontSize=9, spaceAfter=8, alignment=1, textColor=colors.HexColor('#0066cc')))
    styles.add(ParagraphStyle(name='SectionHeader', fontSize=10, spaceAfter=4, spaceBefore=10, fontName='Helvetica-Bold', textColor=colors.HexColor('#000000'), borderPadding=0))
    styles.add(ParagraphStyle(name='ResumeBody', fontSize=9, leading=12, fontName='Helvetica'))
    styles.add(ParagraphStyle(name='BulletItem', fontSize=9, leading=12, leftIndent=15, fontName='Helvetica'))
    styles.add(ParagraphStyle(name='JobTitleLine', fontSize=9, leading=12, fontName='Helvetica-Bold', spaceBefore=6))
    styles.add(ParagraphStyle(name='EduTitleLine', fontSize=9, leading=12, fontName='Helvetica-Bold', spaceBefore=4))
    
    story = []
    content = match.tailored_resume_content
    content = content.replace('L ATEX', 'LaTeX').replace('LATEX', 'LaTeX')
    lines = content.split('\n')
    
    name = None
    title = None
    contact = None
    links_line = None
    
    for line in lines:
        line = line.strip()
        if line.startswith('HEADER_NAME:'):
            name = line.replace('HEADER_NAME:', '').strip()
        elif line.startswith('HEADER_TITLE:'):
            title = line.replace('HEADER_TITLE:', '').strip()
        elif line.startswith('HEADER_CONTACT:'):
            contact = line.replace('HEADER_CONTACT:', '').strip()
        elif line.startswith('HEADER_LINKS:'):
            links_line = line.replace('HEADER_LINKS:', '').strip()
    
    if name:
        story.append(Paragraph(name, styles['ResumeName']))
    if title:
        story.append(Paragraph(title, styles['ResumeTitle']))
    if contact:
        story.append(Paragraph(contact, styles['ContactLine']))
    if links_line:
        link_parts = [p.strip() for p in links_line.split('|')]
        link_html = []
        for part in link_parts:
            if part:
                url = make_url(part)
                display = get_link_display(part)
                link_html.append(f'<a href="{url}" color="#0066cc">{display}</a>')
        story.append(Paragraph(' | '.join(link_html), styles['LinksLine']))
    
    current_section = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        line = line.replace('L ATEX', 'LaTeX').replace('LATEX', 'LaTeX')
        
        if line.startswith('HEADER_'):
            continue
        
        if line.startswith('SECTION:'):
            section_name = line.replace('SECTION:', '').strip().upper()
            story.append(Paragraph(section_name, styles['SectionHeader']))
            current_section = section_name
            continue
        
        if line.startswith('JOBTITLE:'):
            job_info = line.replace('JOBTITLE:', '').strip()
            story.append(Paragraph(job_info, styles['JobTitleLine']))
            continue
        
        if line.startswith('EDUTITLE:'):
            edu_info = line.replace('EDUTITLE:', '').strip()
            story.append(Paragraph(edu_info, styles['EduTitleLine']))
            continue
        
        if line.startswith('BULLET:'):
            bullet_text = line.replace('BULLET:', '').strip()
            bullet_text = format_text_links(bullet_text)
            story.append(Paragraph(f"• {bullet_text}", styles['BulletItem']))
            continue
        
        if current_section:
            clean_line = format_text_links(line)
            story.append(Paragraph(clean_line, styles['ResumeBody']))
    
    doc.build(story)
    buffer.seek(0)
    
    return send_file(buffer, as_attachment=True, download_name=filename, mimetype='application/pdf')


def make_url(text):
    text_lower = text.lower().strip()
    if 'linkedin.com' in text_lower:
        match = re.search(r'linkedin\.com/in/[\w-]+', text_lower)
        return 'https://' + match.group(0) if match else 'https://linkedin.com'
    if 'github.com' in text_lower:
        match = re.search(r'github\.com/[\w-]+', text_lower)
        return 'https://' + match.group(0) if match else 'https://github.com'
    if 'kaggle.com' in text_lower:
        match = re.search(r'kaggle\.com/[\w-]+', text_lower)
        return 'https://' + match.group(0) if match else 'https://kaggle.com'
    if 'medium.com' in text_lower:
        match = re.search(r'medium\.com/@?[\w-]+', text_lower)
        return 'https://' + match.group(0) if match else 'https://medium.com'
    if 'scholar' in text_lower:
        return 'https://scholar.google.com'
    if text_lower.startswith('http'):
        return text.strip()
    return 'https://' + text.strip()


def get_link_display(text):
    t = text.lower()
    if 'linkedin' in t: return 'LinkedIn'
    if 'github' in t: return 'GitHub'
    if 'kaggle' in t: return 'Kaggle'
    if 'medium' in t: return 'Medium'
    if 'scholar' in t: return 'Google Scholar'
    return text.strip()


def format_text_links(text):
    md_link = re.search(r'\[(.*?)\]\((.*?)\)', text)
    if md_link:
        display, url = md_link.group(1), md_link.group(2)
        text = text.replace(md_link.group(0), f'<a href="{url}" color="#0066cc">{display}</a>')
    return text


def extract_name_from_resume(content: str) -> str:
    lines = content.split('\n')
    section_headers = ['PROFESSIONAL SUMMARY', 'SKILLS', 'EXPERIENCE', 'EDUCATION', 'SECTION']
    for line in lines:
        line = line.strip()
        if not line:
            continue
        line_upper = line.upper()
        if any(line_upper.startswith(h) for h in section_headers):
            continue
        if '|' in line or '@' in line:
            continue
        name = re.sub(r'[#*]', '', line).strip()
        name = re.sub(r'[^\w\s]', '', name).strip()
        if name and len(name) > 2:
            return name
    return 'User'


@app.route('/career-roadmap')
@login_required
def career_roadmap():
    user = get_current_user()
    resumes = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).all()
    roadmaps = CareerRoadmap.query.filter_by(user_id=user.id).order_by(CareerRoadmap.created_at.desc()).all()
    return render_template('career_roadmap.html', user=user, resumes=resumes, roadmaps=roadmaps)


@app.route('/career-roadmap/generate', methods=['POST'])
@login_required
def generate_roadmap():
    user = get_current_user()
    
    dream_role = request.form.get('dream_role', '').strip()
    dream_location = request.form.get('dream_location', '').strip()
    timeframe = request.form.get('timeframe', '1 year')
    
    if not dream_role or not dream_location:
        flash('Please provide your dream role and location.', 'error')
        return redirect(url_for('career_roadmap'))
    
    latest_resume = Resume.query.filter_by(user_id=user.id).order_by(Resume.created_at.desc()).first()
    
    if not latest_resume:
        flash('Please upload a resume first.', 'error')
        return redirect(url_for('career_roadmap'))
    
    try:
        result = generate_career_roadmap(
            latest_resume.extracted_text,
            dream_role,
            dream_location,
            timeframe
        )
        
        roadmap = CareerRoadmap(
            user_id=user.id,
            resume_id=latest_resume.id,
            dream_role=dream_role,
            dream_location=dream_location,
            timeframe=timeframe,
            current_gaps=result['currentGaps'],
            skills_to_acquire=result['skillsToAcquire'],
            action_plan=result['actionPlan'],
            resources=result['resources'],
            milestones=result['milestones']
        )
        db.session.add(roadmap)
        db.session.commit()
        
        return redirect(url_for('career_roadmap_results', roadmap_id=roadmap.id))
    
    except Exception as e:
        flash(f'Error generating roadmap: {str(e)}', 'error')
        return redirect(url_for('career_roadmap'))


@app.route('/career-roadmap/<roadmap_id>')
@login_required
def career_roadmap_results(roadmap_id):
    user = get_current_user()
    roadmap = CareerRoadmap.query.get(roadmap_id)
    
    if not roadmap or roadmap.user_id != user.id:
        flash('Roadmap not found.', 'error')
        return redirect(url_for('career_roadmap'))
    
    return render_template('career_roadmap_results.html', roadmap=roadmap, user=user)


@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
