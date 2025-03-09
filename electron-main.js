import { app, BrowserWindow } from 'electron';
import { createServer } from 'vite';
import http from 'http';

async function startViteServer() {
  try {
    const server = await createServer({
      server: {
        port: 3000,
        // Add any additional Vite options here if needed.
      },
    });
    await server.listen();
    console.log('Vite dev server running on port 3000');
  } catch (err) {
    console.error('Error starting Vite dev server:', err);
  }
}

function waitForServer(url, callback) {
  const interval = setInterval(() => {
    http
      .get(url, () => {
        clearInterval(interval);
        callback();
      })
      .on('error', () => {
        console.log('Waiting for Vite dev server to start...');
      });
  }, 1000);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadURL('http://localhost:3000');
}

app.on('ready', async () => {
  await startViteServer();
  // Optionally wait for the server to be reachable
  waitForServer('http://localhost:3000', createWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
