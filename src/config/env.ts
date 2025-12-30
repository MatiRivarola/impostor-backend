import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Game config
  minPlayers: parseInt(process.env.MIN_PLAYERS || '3', 10),
  maxPlayers: parseInt(process.env.MAX_PLAYERS || '10', 10),
  roomTtlActive: parseInt(process.env.ROOM_TTL_ACTIVE || '7200000', 10), // 2 horas
  roomTtlInactive: parseInt(process.env.ROOM_TTL_INACTIVE || '900000', 10), // 15 min
  playerReconnectWindow: parseInt(process.env.PLAYER_RECONNECT_WINDOW || '300000', 10), // 5 min
};

// Validar configuración crítica
export function validateConfig() {
  const errors: string[] = [];

  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('PORT debe ser un número entre 1 y 65535');
  }

  if (!config.redisUrl) {
    errors.push('REDIS_URL es requerido');
  }

  if (config.minPlayers < 2) {
    errors.push('MIN_PLAYERS debe ser al menos 2');
  }

  if (config.maxPlayers > 20) {
    errors.push('MAX_PLAYERS no debe exceder 20');
  }

  if (config.minPlayers > config.maxPlayers) {
    errors.push('MIN_PLAYERS no puede ser mayor que MAX_PLAYERS');
  }

  if (errors.length > 0) {
    console.error('❌ Errores de configuración:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log('✅ Configuración validada correctamente');
}
