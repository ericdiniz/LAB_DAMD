const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/database');
const database = require('./database/database');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const { userLimiter } = require('./middleware/rateLimitUser');

const app = express();

app.use(helmet());
app.use(rateLimit(config.rateLimit));
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ service: 'Task Management API', version: '1.0.0' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', userLimiter, taskRoutes); // <-- aplicado aqui

app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint não encontrado' }));

// handler global de erros com log estruturado
app.use((error, req, res, next) => {
  console.error('unhandled_error', error);
  res.status(500).json({ success: false, message: 'Erro interno do servidor' });
});

async function startServer() {
  try {
    await database.init();
    app.listen(config.port, () => {
      console.log(`Server started on port ${config.port}`);
    });
  } catch (e) {
    console.error('startup_failed', e);
    process.exit(1);
  }
}

if (require.main === module) startServer();
module.exports = app;
