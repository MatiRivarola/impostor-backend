import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config, validateConfig } from './config/env';
import { redis, connectRedis, disconnectRedis } from './config/redis';
import { setupSocketHandlers } from './controllers/socketController';
import { ClientToServerEvents, ServerToClientEvents } from './types';

// Validar configuración
validateConfig();

// Crear app Express
const app = express();
const httpServer = createServer(app);

// Configurar CORS
const corsOptions = {
  origin: config.corsOrigin,
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Crear servidor Socket.IO
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    const activeRooms = await redis.scard('active_rooms');

    res.json({
      status: 'ok',
      redis: 'connected',
      uptime: process.uptime(),
      activeRooms,
      environment: config.nodeEnv,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      redis: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    name: 'Impostor Cordobés Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      websocket: 'ws://<host>',
    },
  });
});

// Iniciar servidor
async function start() {
  try {
    // Conectar a Redis
    await connectRedis();

    // Configurar handlers de Socket.IO
    setupSocketHandlers(io);

    // Iniciar servidor HTTP (escuchar en 0.0.0.0 para permitir conexiones externas)
    httpServer.listen(config.port, '0.0.0.0', () => {
      console.log('');
      console.log('🚀 ============================================');
      console.log(`🚀 Impostor Cordobés Backend`);
      console.log('🚀 ============================================');
      console.log(`🚀 Entorno:        ${config.nodeEnv}`);
      console.log(`🚀 Puerto:         ${config.port}`);
      console.log(`🚀 CORS Origin:    ${config.corsOrigin}`);
      console.log(`🚀 Redis URL:      ${config.redisUrl}`);
      console.log(`🚀 Min Jugadores:  ${config.minPlayers}`);
      console.log(`🚀 Max Jugadores:  ${config.maxPlayers}`);
      console.log('🚀 ============================================');
      console.log(`🚀 Health Check:   http://localhost:${config.port}/health`);
      console.log(`🚀 WebSocket:      ws://localhost:${config.port}`);
      console.log('🚀 ============================================');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

// Manejo de señales de terminación
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM recibido, cerrando servidor...');
  await shutdown();
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT recibido, cerrando servidor...');
  await shutdown();
});

async function shutdown() {
  try {
    console.log('🔄 Cerrando conexiones...');

    // Cerrar servidor HTTP
    httpServer.close(() => {
      console.log('✅ Servidor HTTP cerrado');
    });

    // Cerrar Socket.IO
    io.close(() => {
      console.log('✅ Socket.IO cerrado');
    });

    // Desconectar Redis
    await disconnectRedis();

    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al cerrar servidor:', error);
    process.exit(1);
  }
}

// Iniciar
start();
