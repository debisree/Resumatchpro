#!/usr/bin/env python3
"""
ResuMatch Pro - Flask Microservices Application
Run with: python run.py
"""
import os
import sys

# Add services to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services'))

from gateway.app import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
