import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const WALLET_AGENT_PORT = parseInt(process.env.WALLET_AGENT_PORT || '4003');

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3001'],  // Only allow VR Web Wallet frontend
  credentials: true,
  optionsSuccessStatus: 200
}));

// VR Web Wallet Agent configuration - proxies to existing shared ACA-Py
const WALLET_CONFIG = {
  label: 'vr-wallet.agent',
  acapyAdminUrl: 'http://localhost:8031', // Alice ACA-Py admin API (Holder agent)
  webhookUrl: `http://localhost:${WALLET_AGENT_PORT}/webhooks`,
};

console.log('🚀 Starting VR Web Wallet Agent Server...');
console.log('📊 Configuration:', WALLET_CONFIG);

// Proxy all requests to the wallet's ACA-Py instance
app.use('/admin', async (req, res) => {
  try {
    const url = `${WALLET_CONFIG.acapyAdminUrl}${req.path}`;
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

// Webhook endpoint for ACA-Py events
app.post('/webhooks', (req, res) => {
  console.log('🔔 Webhook received:', JSON.stringify(req.body, null, 2));
  
  // Forward webhook to VR Web Wallet's webhook handler
  if (req.body.topic) {
    fetch('http://localhost:3001/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    }).catch(error => {
      console.error('Failed to forward webhook:', error);
    });
  }
  
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'vr-wallet-agent-server',
    timestamp: new Date().toISOString()
  });
});

app.listen(WALLET_AGENT_PORT, () => {
  console.log(`✅ VR Web Wallet Agent Server running on http://localhost:${WALLET_AGENT_PORT}`);
  console.log(`🔗 Admin API proxy: http://localhost:${WALLET_AGENT_PORT}/admin/*`);
  console.log(`📨 Webhook endpoint: http://localhost:${WALLET_AGENT_PORT}/webhooks`);
});