import { RoomData, ValidationResult, OnlinePhase } from '../types';
import { config } from '../config/env';

/**
 * Valida que un jugador puede iniciar el juego
 */
export function validateStartGame(
  room: RoomData,
  playerId: string
): ValidationResult {
  if (room.hostId !== playerId) {
    return {
      valid: false,
      error: 'Solo el anfitrión puede iniciar el juego',
    };
  }

  if (room.players.length < config.minPlayers) {
    return {
      valid: false,
      error: `Mínimo ${config.minPlayers} jugadores requeridos`,
    };
  }

  if (room.phase !== 'LOBBY') {
    return {
      valid: false,
      error: 'El juego ya está en curso',
    };
  }

  return { valid: true };
}

/**
 * Valida que un jugador puede cambiar de fase
 */
export function validateChangePhase(
  room: RoomData,
  playerId: string,
  nextPhase: OnlinePhase
): ValidationResult {
  if (room.hostId !== playerId) {
    return {
      valid: false,
      error: 'Solo el anfitrión puede cambiar de fase',
    };
  }

  // Validar transiciones específicas
  const validTransitions: Record<OnlinePhase, OnlinePhase[]> = {
    LOBBY: ['ASSIGNMENT'],
    ASSIGNMENT: ['DEBATE'],
    DEBATE: ['VOTING'],
    VOTING: ['ELIMINATION', 'RESULT'],
    ELIMINATION: ['DEBATE', 'RESULT'],
    RESULT: ['LOBBY'],
  };

  const allowed = validTransitions[room.phase] || [];
  if (!allowed.includes(nextPhase)) {
    return {
      valid: false,
      error: `Transición inválida: ${room.phase} → ${nextPhase}`,
    };
  }

  return { valid: true };
}

/**
 * Valida que un jugador puede votar
 */
export function validateVote(
  room: RoomData,
  voterId: string,
  victimId: string
): ValidationResult {
  const voter = room.players.find((p) => p.id === voterId);
  const victim = room.players.find((p) => p.id === victimId);

  if (!voter) {
    return {
      valid: false,
      error: 'Votante no encontrado',
    };
  }

  if (!victim) {
    return {
      valid: false,
      error: 'Jugador votado no encontrado',
    };
  }

  if (room.phase !== 'VOTING') {
    return {
      valid: false,
      error: 'No es fase de votación',
    };
  }

  if (voter.isDead) {
    return {
      valid: false,
      error: 'Los jugadores eliminados no pueden votar',
    };
  }

  if (victim.isDead) {
    return {
      valid: false,
      error: 'No puedes votar a un jugador eliminado',
    };
  }

  if (voterId === victimId) {
    return {
      valid: false,
      error: 'No puedes votarte a ti mismo',
    };
  }

  return { valid: true };
}

/**
 * Valida que un jugador puede reiniciar el juego
 */
export function validateResetGame(
  room: RoomData,
  playerId: string
): ValidationResult {
  if (room.hostId !== playerId) {
    return {
      valid: false,
      error: 'Solo el anfitrión puede reiniciar el juego',
    };
  }

  if (room.phase !== 'RESULT') {
    return {
      valid: false,
      error: 'Solo se puede reiniciar desde la fase de resultados',
    };
  }

  return { valid: true };
}

/**
 * Valida nombre de jugador
 */
export function validatePlayerName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: 'El nombre no puede estar vacío',
    };
  }

  if (name.length > 20) {
    return {
      valid: false,
      error: 'El nombre no puede tener más de 20 caracteres',
    };
  }

  // No permitir caracteres especiales peligrosos
  const dangerousChars = /[<>{}]/;
  if (dangerousChars.test(name)) {
    return {
      valid: false,
      error: 'El nombre contiene caracteres no permitidos',
    };
  }

  return { valid: true };
}

/**
 * Valida código de sala
 */
export function validateRoomCode(code: string): ValidationResult {
  if (!code || code.length !== 4) {
    return {
      valid: false,
      error: 'El código debe tener 4 caracteres',
    };
  }

  // Solo alfanuméricos
  const validChars = /^[A-Z0-9]+$/;
  if (!validChars.test(code)) {
    return {
      valid: false,
      error: 'El código solo puede contener letras y números',
    };
  }

  return { valid: true };
}

/**
 * Valida configuración del juego
 */
export function validateGameConfig(
  config: any,
  playerCount: number
): ValidationResult {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Configuración del juego requerida' };
  }

  if (!Array.isArray(config.themes) || config.themes.length === 0) {
    return { valid: false, error: 'Debe seleccionar al menos un tema' };
  }

  const validThemes = ['argentina', 'cordoba', 'memes_argentinos', 'religion', 'farandula', 'comida',
                       'futbol', 'marcas', 'musica', 'lugares', 'objetos',
                       'mitos', 'scifi', 'historia'];
  const invalidThemes = config.themes.filter((t: string) => !validThemes.includes(t));
  if (invalidThemes.length > 0) {
    return { valid: false, error: `Temas inválidos: ${invalidThemes.join(', ')}` };
  }

  if (typeof config.impostorCount !== 'number' || config.impostorCount < 1) {
    return { valid: false, error: 'Debe haber al menos 1 impostor' };
  }

  // Validar undercover count
  if (config.undercoverCount !== undefined) {
    if (typeof config.undercoverCount !== 'number' || config.undercoverCount < 0) {
      return { valid: false, error: 'Cantidad de undercover inválida' };
    }
  }

  // Validar total de roles especiales
  const undercoverCount = config.undercoverCount || 0;
  const totalSpecialRoles = config.impostorCount + undercoverCount;

  // Solo validar que quede al menos 1 ciudadano
  if (totalSpecialRoles >= playerCount) {
    return { valid: false, error: 'Debe haber al menos 1 ciudadano' };
  }

  const validModes = ['classic', 'chaos', 'hardcore'];
  if (!validModes.includes(config.gameMode)) {
    return { valid: false, error: 'Modo de juego inválido' };
  }

  return { valid: true };
}
