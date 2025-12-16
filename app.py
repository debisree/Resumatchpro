from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, send_file
from functools import wraps
import os
import json
import re
import io

from config import Config
from models import db, User, Resume, Analysis, JobMatch, CareerRoadmap
from auth import hash_password, verify_password
from file_processor import extract_text_from_file, get_mime_type
from ai_service import (
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


def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = Config.SECRET_KEY
    
    # Ensure DATABASE_URL is set
    if not hasattr(Config, 'DATABASE_URL') or not Config.DATABASE_URL:
        # Final fallback if somehow DATABASE_URL is still not set
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resumatch.db')
        app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
        print(f"CRITICAL: DATABASE_URL was not set. Using fallback SQLite at: {db_path}")
    else:
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
        return redirect(url_for('home'))
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
        return redirect(url_for('home'))
    
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
            return redirect(url_for('home'))
        
        flash('Invalid username or password.', 'error')
    
    return render_template('login.html')


@app.route('/logout')
def logout():
    session.pop('user_id', None)
    flash('Logged out successfully.', 'success')
    return redirect(url_for('index'))


@app.route('/home')
@login_required
def home():
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
        return redirect(url_for('home'))
    
    file = request.files['file']
    if file.filename == '':
        flash('No file selected.', 'error')
        return redirect(url_for('home'))
    
    if not Config.allowed_file(file.filename):
        flash('Invalid file type. Please upload PDF, DOCX, PNG, JPG, or TXT.', 'error')
        return redirect(url_for('home'))
    
    try:
        file_content = file.read()
        mime_type = get_mime_type(file.filename)
        extracted_text = extract_text_from_file(file_content, mime_type)
        
        if not extracted_text or len(extracted_text.strip()) < 50:
            flash('Could not extract sufficient text from the file.', 'error')
            return redirect(url_for('home'))
        
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
        return redirect(url_for('home'))
    
    except Exception as e:
        flash(f'Error processing file: {str(e)}', 'error')
        return redirect(url_for('home'))


@app.route('/resume/<resume_id>/delete', methods=['POST'])
@login_required
def delete_resume(resume_id):
    user = get_current_user()
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    
    if not resume:
        flash('Resume not found.', 'error')
        return redirect(url_for('home'))
    
    try:
        Analysis.query.filter_by(resume_id=resume_id).delete()
        JobMatch.query.filter_by(resume_id=resume_id).delete()
        CareerRoadmap.query.filter_by(resume_id=resume_id).delete()
        
        db.session.delete(resume)
        db.session.commit()
        
        flash('Resume deleted successfully.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting resume: {str(e)}', 'error')
    
    return redirect(url_for('home'))


@app.route('/analyze-resume/<resume_id>')
@login_required
def analyze_resume_route(resume_id):
    user = get_current_user()
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    
    if not resume:
        flash('Resume not found.', 'error')
        return redirect(url_for('home'))
    
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
        return redirect(url_for('home'))


@app.route('/analysis/<analysis_id>')
@login_required
def analysis_results(analysis_id):
    user = get_current_user()
    analysis = Analysis.query.get(analysis_id)
    
    if not analysis:
        flash('Analysis not found.', 'error')
        return redirect(url_for('home'))
    
    resume = Resume.query.get(analysis.resume_id)
    if resume.user_id != user.id:
        flash('Access denied.', 'error')
        return redirect(url_for('home'))
    
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


def make_url(url):
    if not url:
        return ''
    url = url.strip()
    if not url.startswith('http://') and not url.startswith('https://'):
        return 'https://' + url
    return url


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
    
    content = match.tailored_resume_content
    
    try:
        resume_data = json.loads(content)
        return generate_pdf_from_json(resume_data)
    except json.JSONDecodeError:
        return generate_pdf_from_text(content)


def generate_pdf_from_json(data):
    header = data.get('header', {})
    sections = data.get('sections', [])
    
    name = header.get('name', 'Resume')
    safe_name = re.sub(r'[^\w\s-]', '', name).replace(' ', '_')
    filename = f"{safe_name}_tailored_resume.pdf"
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=36, bottomMargin=36)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ResumeName', fontSize=16, spaceAfter=0, alignment=1, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='ResumeTitle', fontSize=10, spaceAfter=4, alignment=1, fontName='Helvetica', textColor=colors.HexColor('#555555')))
    styles.add(ParagraphStyle(name='ContactLine', fontSize=9, spaceAfter=2, alignment=1, textColor=colors.HexColor('#333333')))
    styles.add(ParagraphStyle(name='LinksLine', fontSize=9, spaceAfter=6, alignment=1, textColor=colors.HexColor('#0066cc')))
    styles.add(ParagraphStyle(name='SectionHeader', fontSize=10, spaceAfter=4, spaceBefore=10, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='ResumeBody', fontSize=9, leading=12, fontName='Helvetica'))
    styles.add(ParagraphStyle(name='BulletItem', fontSize=9, leading=12, leftIndent=15, fontName='Helvetica'))
    styles.add(ParagraphStyle(name='JobTitleLine', fontSize=9, leading=12, fontName='Helvetica-Bold', spaceBefore=6))
    styles.add(ParagraphStyle(name='SkillLine', fontSize=9, leading=12, fontName='Helvetica'))
    
    story = []
    
    if name:
        story.append(Paragraph(name, styles['ResumeName']))
        story.append(Spacer(1, 8))
    
    titles = header.get('titles', [])
    if titles:
        story.append(Paragraph(' | '.join(titles), styles['ResumeTitle']))
    
    contact_parts = []
    if header.get('email'):
        contact_parts.append(header['email'])
    if header.get('phone'):
        contact_parts.append(header['phone'])
    if header.get('location'):
        contact_parts.append(header['location'])
    if contact_parts:
        story.append(Paragraph(' | '.join(contact_parts), styles['ContactLine']))
    
    link_html = []
    if header.get('linkedin'):
        url = make_url(header['linkedin'])
        link_html.append(f'<a href="{url}" color="#0066cc">LinkedIn</a>')
    if header.get('github'):
        url = make_url(header['github'])
        link_html.append(f'<a href="{url}" color="#0066cc">GitHub</a>')
    if header.get('kaggle'):
        url = make_url(header['kaggle'])
        link_html.append(f'<a href="{url}" color="#0066cc">Kaggle</a>')
    if header.get('medium'):
        url = make_url(header['medium'])
        link_html.append(f'<a href="{url}" color="#0066cc">Medium</a>')
    if header.get('google_scholar'):
        url = make_url(header['google_scholar'])
        link_html.append(f'<a href="{url}" color="#0066cc">Google Scholar</a>')
    
    if link_html:
        story.append(Paragraph(' | '.join(link_html), styles['LinksLine']))
    
    for section in sections:
        title = section.get('title', '')
        section_type = section.get('type', 'paragraph')
        content = section.get('content', '')
        
        story.append(Paragraph(title.upper(), styles['SectionHeader']))
        
        if section_type == 'paragraph':
            text = content.replace('L ATEX', 'LaTeX') if isinstance(content, str) else str(content)
            story.append(Paragraph(text, styles['ResumeBody']))
        
        elif section_type == 'skills':
            if isinstance(content, list):
                for skill in content:
                    cat = skill.get('category', '')
                    items = skill.get('items', '')
                    items = items.replace('L ATEX', 'LaTeX') if isinstance(items, str) else str(items)
                    story.append(Paragraph(f"<b>{cat}:</b> {items}", styles['SkillLine']))
        
        elif section_type == 'inline':
            text = content.replace('L ATEX', 'LaTeX') if isinstance(content, str) else str(content)
            story.append(Paragraph(text, styles['ResumeBody']))
        
        elif section_type == 'jobs':
            if isinstance(content, list):
                for job in content:
                    job_title = job.get('job_title', '')
                    company = job.get('company', '')
                    location = job.get('location', '')
                    dates = job.get('dates', '')
                    header_line = f"{job_title} | {company} | {location} | {dates}"
                    story.append(Paragraph(header_line, styles['JobTitleLine']))
                    for bullet in job.get('bullets', []):
                        bullet = bullet.replace('L ATEX', 'LaTeX') if isinstance(bullet, str) else str(bullet)
                        story.append(Paragraph(f"• {bullet}", styles['BulletItem']))
        
        elif section_type == 'education':
            if isinstance(content, list):
                for edu in content:
                    degree = edu.get('degree', '')
                    institution = edu.get('institution', '')
                    dates = edu.get('dates', '')
                    header_line = f"{degree} | {institution} | {dates}"
                    story.append(Paragraph(header_line, styles['JobTitleLine']))
                    for bullet in edu.get('bullets', []):
                        bullet = bullet.replace('L ATEX', 'LaTeX') if isinstance(bullet, str) else str(bullet)
                        story.append(Paragraph(f"• {bullet}", styles['BulletItem']))
        
        elif section_type == 'bullets':
            if isinstance(content, list):
                for item in content:
                    item = item.replace('L ATEX', 'LaTeX') if isinstance(item, str) else str(item)
                    story.append(Paragraph(f"• {item}", styles['BulletItem']))
    
    doc.build(story)
    buffer.seek(0)
    
    return send_file(buffer, as_attachment=True, download_name=filename, mimetype='application/pdf')


def generate_pdf_from_text(content):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=36, bottomMargin=36)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ResumeBody', fontSize=10, leading=14, fontName='Helvetica'))
    
    story = []
    for line in content.split('\n'):
        if line.strip():
            story.append(Paragraph(line, styles['ResumeBody']))
            story.append(Spacer(1, 6))
    
    doc.build(story)
    buffer.seek(0)
    
    return send_file(buffer, as_attachment=True, download_name='tailored_resume.pdf', mimetype='application/pdf')


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
