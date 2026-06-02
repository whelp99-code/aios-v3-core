import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let nextProcess: any = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // 개발 모드: localhost:3000에서 Next.js 로드
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 프로덕션 모드: 빌드된 파일 로드
    mainWindow.loadFile(path.join(__dirname, '../web/out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startNextServer() {
  const webDir = path.join(__dirname, '../../apps/web');
  nextProcess = spawn('pnpm', ['dev'], {
    cwd: webDir,
    stdio: 'inherit',
  });

  nextProcess.on('error', (err: any) => {
    console.error('Failed to start Next.js server:', err);
  });
}

app.on('ready', () => {
  if (process.env.NODE_ENV === 'development') {
    startNextServer();
    // Next.js 서버가 시작될 때까지 대기
    setTimeout(createWindow, 3000);
  } else {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (nextProcess) {
      nextProcess.kill();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
