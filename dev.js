const { spawn } = require('child_process');
const path = require('path');

console.log('🌾 Starting Kisan Sethu Full-Stack Environment (FastAPI Backend + Vite Frontend)...');
console.log('1. Starting FastAPI Backend (http://127.0.0.1:8000)...');
console.log('2. Starting Vite Frontend (http://localhost:3000)...');

const venvUvicorn = path.join(__dirname, 'backend', '.venv', 'Scripts', 'uvicorn.exe');
const fs = require('fs');
let backendCmd = 'uv';
let backendArgs = ['run', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8000'];

if (fs.existsSync(venvUvicorn)) {
  backendCmd = `"${venvUvicorn}"`;
  backendArgs = ['app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', '8000'];
}

// 1. Start Python FastAPI Backend
const backend = spawn(backendCmd, backendArgs, {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

backend.on('error', (err) => {
  console.warn('Backend start warning (Python Launcher):', err.message);
});

// 2. Start Frontend Vite Server
const frontend = spawn('npm', ['--prefix', 'frontend', 'run', 'dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

frontend.on('close', (code) => {
  try { backend.kill(); } catch (e) {}
  process.exit(code);
});

process.on('SIGINT', () => {
  try { backend.kill(); } catch (e) {}
  try { frontend.kill(); } catch (e) {}
  process.exit();
});
