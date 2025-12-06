#!/usr/bin/env python3
"""
ResuMatch Pro - Simplified Flask Application
Run with: python run.py or python app.py
"""
import os

from app import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
