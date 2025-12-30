import { redis } from '../config/redis';
import { config } from '../config/env';
import { Player } from '../types';
import { getRoom, updatePlayer, getPlayerById } from './roomService';

/**
 * Verifica si un jugador puede reconectarse (ventana de 5 min)
 */
export async function canPlayerReconnect(
  code: string,
  playerId: string
): Promise<boolean> {
  const player = await getPlayerById(code, playerId);
  if (!player) return false;

  const timeSinceLastSeen = Date.now() - player.lastSeen;
  const canReconnect = timeSinceLastSeen <= config.playerReconnectWindow;

  console.log(
    `🔍 Verificando reconexión: ${player.name}, tiempo: ${Math.floor(timeSinceLastSeen / 1000)}s, permitido: ${canReconnect}`
  );

  return canReconnect;
}

/**
 * Busca jugadores inactivos y los elimina
 * (Llamado por un timer o manualmente)
 */
export async function cleanupInactivePlayers(code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room) return;

  const now = Date.now();
  const playersToRemove: string[] = [];

  for (const player of room.players) {
    const timeSinceLastSeen = now - player.lastSeen;
    if (timeSinceLastSeen > config.playerReconnectWindow) {
      playersToRemove.push(player.id);
    }
  }

  for (const playerId of playersToRemove) {
    const player = await getPlayerById(code, playerId);
    if (player) {
      await redis.hdel(`room:${code}:players`, playerId);
      await redis.hdel(`room:${code}:sockets`, player.socketId);
      console.log(`🗑️  Jugador inactivo ${player.name} eliminado de sala ${code}`);
    }
  }
}

/**
 * Marca un jugador como desconectado (actualiza lastSeen)
 */
export async function markPlayerDisconnected(
  code: string,
  playerId: string
): Promise<void> {
  await updatePlayer(code, playerId, {
    lastSeen: Date.now(),
  });

  console.log(`⚠️  Jugador marcado como desconectado en sala ${code}`);
}

/**
 * Obtiene jugadores conectados (lastSeen < 60 segundos)
 */
export async function getConnectedPlayers(
  code: string
): Promise<Player[]> {
  const room = await getRoom(code);
  if (!room) return [];

  const now = Date.now();
  const connectedPlayers = room.players.filter(
    (p) => now - p.lastSeen < 60000 // Activos en el último minuto
  );

  return connectedPlayers;
}

/**
 * Transfiere el rol de host a otro jugador
 */
export async function transferHost(
  code: string,
  newHostId: string
): Promise<void> {
  const room = await getRoom(code);
  if (!room) throw new Error('Sala no encontrada');

  const newHost = room.players.find((p) => p.id === newHostId);
  if (!newHost) throw new Error('Nuevo host no encontrado');

  room.hostId = newHostId;
  room.lastActivity = Date.now();

  await redis.hset(`room:${code}`, 'data', JSON.stringify(room));

  console.log(`👑 Host transferido a ${newHost.name} en sala ${code}`);
}
