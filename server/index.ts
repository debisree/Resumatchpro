import { spawn } from 'child_process';
import path from 'path';

// ResuMatch Pro Flask Microservices Application
// This starts the Python Flask application instead of Node.js Express

console.log('Starting ResuMatch Pro Flask application...');

const pythonProcess = spawn('python', ['run.py'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env }
});

pythonProcess.on('error', (error) => {
  console.error('Failed to start Flask application:', error);
  process.exit(1);
});

pythonProcess.on('exit', (code) => {
  console.log(`Flask application exited with code ${code}`);
  process.exit(code || 0);
});

// Handle termination signals
process.on('SIGINT', () => {
  pythonProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  pythonProcess.kill('SIGTERM');
});
