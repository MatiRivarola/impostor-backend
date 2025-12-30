import Redis from 'ioredis';
import { config } from './env';

export const redis = new Redis(config.redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('✅ Redis conectado exitosamente');
});

redis.on('ready', () => {
  console.log('✅ Redis listo para recibir comandos');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redis.on('close', () => {
  console.log('⚠️  Redis conexión cerrada');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis reconectando...');
});

// Verificar conexión al iniciar
export async function connectRedis(): Promise<void> {
  try {
    await redis.ping();
    console.log('✅ Redis PING successful');
  } catch (error) {
    console.error('❌ No se pudo conectar a Redis:', error);
    process.exit(1);
  }
}

// Cleanup graceful
export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    console.log('✅ Redis desconectado correctamente');
  } catch (error) {
    console.error('❌ Error al desconectar Redis:', error);
  }
}
