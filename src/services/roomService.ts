import { redis } from '../config/redis';
import { config } from '../config/env';
import { RoomData, Player, OnlinePhase } from '../types';
import { generateRoomCode } from './wordService';
import { v4 as uuidv4 } from 'uuid';
import * as avatarService from './avatarService';

// Helper: Generar código único de sala
async function generateUniqueRoomCode(): Promise<string> {
  let code = generateRoomCode();
  let attempts = 0;
  const maxAttempts = 10;

  // Verificar que el código no exista (muy raro con 32^4 combinaciones)
  while (await redis.exists(`room:${code}`) && attempts < maxAttempts) {
    code = generateRoomCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('No se pudo generar código único de sala');
  }

  return code;
}

/**
 * Crea una nueva sala con el host
 */
export async function createRoom(
  playerName: string,
  hostSocketId: string
): Promise<RoomData> {
  const code = await generateUniqueRoomCode();
  const playerId = uuidv4();
  const now = Date.now();

  const { avatar, color } = avatarService.assignPlayerAvatar(code, []);

  const host: Player = {
    id: playerId,
    name: playerName,
    role: 'citizen',
    word: undefined,
    isDead: false,
    socketId: hostSocketId,
    lastSeen: now,
    avatar,
    color,
  };

  const room: RoomData = {
    code,
    hostId: playerId,
    phase: 'LOBBY',
    players: [host],
    secretWord: '',
    undercoverWord: '',
    winner: null,
    createdAt: now,
    lastActivity: now,
  };

  // Guardar en Redis
  await redis.hset(`room:${code}`, 'data', JSON.stringify(room));
  await redis.hset(`room:${code}:players`, playerId, JSON.stringify(host));
  await redis.hset(`room:${code}:sockets`, hostSocketId, playerId);
  await redis.sadd('active_rooms', code);

  // TTL de 2 horas
  await redis.expire(`room:${code}`, config.roomTtlActive / 1000);
  await redis.expire(`room:${code}:players`, config.roomTtlActive / 1000);
  await redis.expire(`room:${code}:sockets`, config.roomTtlActive / 1000);

  console.log(`✅ Sala creada: ${code} (Host: ${playerName})`);
  return room;
}

/**
 * Obtiene una sala por código
 */
export async function getRoom(code: string): Promise<RoomData | null> {
  const roomData = await redis.hget(`room:${code}`, 'data');
  if (!roomData) return null;

  const room: RoomData = JSON.parse(roomData);

  // Cargar jugadores
  const playersData = await redis.hgetall(`room:${code}:players`);
  room.players = Object.values(playersData).map((p) => JSON.parse(p));

  return room;
}

/**
 * Actualiza datos de una sala
 */
export async function updateRoom(
  code: string,
  updates: Partial<RoomData>
): Promise<void> {
  const room = await getRoom(code);
  if (!room) throw new Error(`Sala ${code} no encontrada`);

  const updatedRoom: RoomData = {
    ...room,
    ...updates,
    lastActivity: Date.now(),
  };

  await redis.hset(`room:${code}`, 'data', JSON.stringify(updatedRoom));

  // CRITICAL FIX: Sincronizar hash de players si fueron actualizados
  if (updates.players) {
    for (const player of updates.players) {
      await redis.hset(
        `room:${code}:players`,
        player.id,
        JSON.stringify(player)
      );
    }
  }

  // Renovar TTL
  await redis.expire(`room:${code}`, config.roomTtlActive / 1000);
}

/**
 * Agrega un jugador a una sala
 */
export async function addPlayerToRoom(
  code: string,
  playerName: string,
  socketId: string
): Promise<{ room: RoomData; playerId: string }> {
  const room = await getRoom(code);
  if (!room) throw new Error('Sala no encontrada');

  // Validaciones
  if (room.phase !== 'LOBBY') {
    throw new Error('La partida ya empezó');
  }

  if (room.players.length >= config.maxPlayers) {
    throw new Error('Sala llena');
  }

  // Verificar nombre no duplicado
  if (room.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
    throw new Error('Ese nombre ya está en uso en esta sala');
  }

  const playerId = uuidv4();
  const now = Date.now();

  const { avatar, color } = avatarService.assignPlayerAvatar(code, room.players);

  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    role: 'citizen',
    word: undefined,
    isDead: false,
    socketId,
    lastSeen: now,
    avatar,
    color,
  };

  // Guardar jugador
  await redis.hset(`room:${code}:players`, playerId, JSON.stringify(newPlayer));
  await redis.hset(`room:${code}:sockets`, socketId, playerId);

  // Actualizar actividad
  room.lastActivity = now;
  await redis.hset(`room:${code}`, 'data', JSON.stringify(room));

  console.log(`✅ Jugador ${playerName} se unió a sala ${code}`);

  // Retornar sala actualizada
  const updatedRoom = await getRoom(code);
  if (!updatedRoom) throw new Error('Error al obtener sala actualizada');

  return { room: updatedRoom, playerId };
}

/**
 * Actualiza un jugador en la sala
 */
export async function updatePlayer(
  code: string,
  playerId: string,
  updates: Partial<Player>
): Promise<void> {
  const playerData = await redis.hget(`room:${code}:players`, playerId);
  if (!playerData) throw new Error('Jugador no encontrado');

  const player: Player = JSON.parse(playerData);
  const updatedPlayer: Player = { ...player, ...updates };

  await redis.hset(
    `room:${code}:players`,
    playerId,
    JSON.stringify(updatedPlayer)
  );
}

/**
 * Elimina una sala completamente
 */
export async function deleteRoom(code: string): Promise<void> {
  // Limpiar avatares de la sala
  avatarService.clearRoomAvatars(code);

  await redis.del(`room:${code}`);
  await redis.del(`room:${code}:players`);
  await redis.del(`room:${code}:sockets`);
  await redis.del(`room:${code}:votes`);
  await redis.srem('active_rooms', code);

  console.log(`🗑️  Sala ${code} eliminada`);
}

/**
 * Elimina un jugador de una sala
 */
export async function removePlayerFromRoom(
  code: string,
  playerId: string
): Promise<void> {
  const player = await getPlayerById(code, playerId);
  if (!player) return;

  // Liberar avatar
  if (player.avatar && player.color) {
    avatarService.releasePlayerAvatar(code, player.avatar, player.color);
  }

  await redis.hdel(`room:${code}:players`, playerId);
  await redis.hdel(`room:${code}:sockets`, player.socketId);

  console.log(`🗑️  Jugador ${player.name} eliminado de sala ${code}`);

  // Si no quedan jugadores, eliminar sala
  const remainingPlayers = await redis.hlen(`room:${code}:players`);
  if (remainingPlayers === 0) {
    await deleteRoom(code);
  }
}

/**
 * Obtiene un jugador por ID
 */
export async function getPlayerById(
  code: string,
  playerId: string
): Promise<Player | null> {
  const playerData = await redis.hget(`room:${code}:players`, playerId);
  if (!playerData) return null;
  return JSON.parse(playerData);
}

/**
 * Actualiza el mapping de socket a player
 */
export async function updateSocketMapping(
  code: string,
  playerId: string,
  newSocketId: string
): Promise<void> {
  const player = await getPlayerById(code, playerId);
  if (!player) throw new Error('Jugador no encontrado');

  // Eliminar mapping viejo
  await redis.hdel(`room:${code}:sockets`, player.socketId);

  // Crear mapping nuevo
  await redis.hset(`room:${code}:sockets`, newSocketId, playerId);

  // Actualizar jugador
  await updatePlayer(code, playerId, {
    socketId: newSocketId,
    lastSeen: Date.now(),
  });

  console.log(`🔄 Socket actualizado para jugador ${player.name} en sala ${code}`);
}

/**
 * Obtiene el playerId asociado a un socketId
 */
export async function getPlayerIdBySocketId(
  code: string,
  socketId: string
): Promise<string | null> {
  return await redis.hget(`room:${code}:sockets`, socketId);
}

/**
 * Busca en qué sala está un socket
 */
export async function findRoomBySocketId(
  socketId: string
): Promise<{ room: RoomData; playerId: string } | null> {
  const activeCodes = await redis.smembers('active_rooms');

  for (const code of activeCodes) {
    const playerId = await redis.hget(`room:${code}:sockets`, socketId);
    if (playerId) {
      const room = await getRoom(code);
      if (room) {
        return { room, playerId };
      }
    }
  }

  return null;
}

/**
 * Guarda un voto con información completa del votante
 */
export async function saveVote(
  code: string,
  voterId: string,
  voterName: string,
  votedPlayerId: string
): Promise<void> {
  const voteInfo = {
    voterId,
    voterName,
    voterInitials: voterName.substring(0, 2).toUpperCase(),
    votedPlayerId,
    timestamp: Date.now(),
  };

  await redis.hset(`room:${code}:votes`, voterId, JSON.stringify(voteInfo));
}

/**
 * Obtiene todos los votos de una sala (legacy - retorna Map)
 */
export async function getVotes(code: string): Promise<Map<string, string>> {
  const votesData = await redis.hgetall(`room:${code}:votes`);
  const parsedVotes = new Map<string, string>();

  for (const [voterId, voteInfoJson] of Object.entries(votesData)) {
    const voteInfo = JSON.parse(voteInfoJson);
    parsedVotes.set(voterId, voteInfo.votedPlayerId);
  }

  return parsedVotes;
}

/**
 * Obtiene todos los votos con información completa
 */
export async function getVotesInfo(code: string): Promise<any[]> {
  const votesData = await redis.hgetall(`room:${code}:votes`);
  return Object.values(votesData).map(v => JSON.parse(v));
}

/**
 * Limpia todos los votos de una sala
 */
export async function clearVotes(code: string): Promise<void> {
  await redis.del(`room:${code}:votes`);
}
