// start-vite.js
import { createServer } from 'vite';

async function startServer() {
  try {
    const server = await createServer({
      server: {
        port: 3000,
      },
    });
    await server.listen();
    console.log('Vite dev server running on port 3000');
  } catch (err) {
    console.error('Error starting Vite dev server:', err);
  }
}

startServer();
