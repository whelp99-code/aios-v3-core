import { createApp } from './app.js';

const PORT = process.env.PORT || 3201;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Workflow API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`API key auth: ${process.env.API_KEY ? 'enabled' : 'disabled (dev mode)'}`);
});

export default app;
