import { createApp } from './app.js';

const PORT = Number(process.env.API_PORT || 4000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`[LedgerFlow API] v2.0.0 listening on :${PORT}`);
  console.log(`[LedgerFlow API] Health: http://localhost:${PORT}/health`);
});