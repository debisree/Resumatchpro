// This file spawns the Python Flask application
// The Flask app is located in services/gateway/app.py
import { spawn } from 'child_process';
import { resolve } from 'path';

console.log('Starting Python Flask application...');

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
