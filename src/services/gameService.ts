import { Player, OnlinePhase, GameConfig } from '../types';
import { getGameWords } from './wordService';

/**
 * Asigna roles y palabras a los jugadores (server-side)
 * Los ciudadanos ven la palabra secreta, el impostor NO
 */
export function assignRoles(
  players: Player[],
  config: GameConfig
): { players: Player[]; secretWord: string } {
  if (players.length < 2) {
    throw new Error('Se necesitan al menos 2 jugadores');
  }

  // Validar configuración
  const maxImpostors = Math.floor(players.length / 2);
  if (config.impostorCount < 1 || config.impostorCount > maxImpostors) {
    throw new Error(`Número de impostores inválido (1-${maxImpostors})`);
  }

  // 1. Obtener palabra secreta usando temas configurados
  const { secretWord } = getGameWords(config.themes);

  // 2. Seleccionar múltiples impostores aleatoriamente
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const impostorIds = new Set(
    shuffled.slice(0, config.impostorCount).map(p => p.id)
  );

  // 3. Asignar roles y palabras
  const updatedPlayers = players.map((player) => {
    if (impostorIds.has(player.id)) {
      // Impostor: NO ve la palabra
      return {
        ...player,
        role: 'impostor' as const,
        word: undefined,
        isDead: false,
      };
    } else {
      // Ciudadano: ve la palabra secreta
      return {
        ...player,
        role: 'citizen' as const,
        word: secretWord,
        isDead: false,
      };
    }
  });

  console.log(`🎮 Roles asignados: ${config.impostorCount} impostor(es)`);
  console.log(`📝 Palabra secreta: "${secretWord}"`);
  console.log(`🎨 Temas: ${config.themes.join(', ')}`);

  return {
    players: updatedPlayers,
    secretWord,
  };
}

/**
 * Valida transiciones de fase
 */
export function validatePhaseTransition(
  current: OnlinePhase,
  next: OnlinePhase
): boolean {
  const validTransitions: Record<OnlinePhase, OnlinePhase[]> = {
    LOBBY: ['ASSIGNMENT'],
    ASSIGNMENT: ['DEBATE'],
    DEBATE: ['VOTING'],
    VOTING: ['RESULT'],
    RESULT: ['LOBBY'], // Reiniciar partida
  };

  const allowed = validTransitions[current] || [];
  const isValid = allowed.includes(next);

  if (!isValid) {
    console.warn(`⚠️  Transición inválida: ${current} → ${next}`);
  }

  return isValid;
}

/**
 * Calcula el resultado de la votación
 * @param votes - Map de voterId → votedPlayerId
 * @param players - Lista de jugadores
 * @returns Resultado de la votación
 */
export function calculateVoteResult(
  votes: Map<string, string>,
  players: Player[]
): {
  victimId: string;
  winner: 'citizens' | 'impostor';
  voteCounts: Map<string, number>;
} {
  // Contar votos
  const voteCounts = new Map<string, number>();

  for (const votedId of votes.values()) {
    voteCounts.set(votedId, (voteCounts.get(votedId) || 0) + 1);
  }

  // Encontrar al más votado
  let maxVotes = 0;
  let victimId = '';

  for (const [playerId, count] of voteCounts.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      victimId = playerId;
    }
  }

  // Si nadie tiene votos, no hay víctima (empate o nadie votó)
  if (!victimId) {
    // Decidir aleatoriamente entre los jugadores vivos
    const alivePlayers = players.filter((p) => !p.isDead);
    victimId = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
  }

  // Determinar ganador basado en el rol de la víctima
  const victim = players.find((p) => p.id === victimId);
  if (!victim) {
    throw new Error('Víctima no encontrada');
  }

  const winner: 'citizens' | 'impostor' =
    victim.role === 'impostor' ? 'citizens' : 'impostor';

  console.log(
    `🗳️  Resultado votación: ${victim.name} eliminado (${victim.role}). Ganador: ${winner}`
  );

  return {
    victimId,
    winner,
    voteCounts,
  };
}

/**
 * Reset jugadores para nueva partida
 */
export function resetPlayers(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    role: 'citizen',
    word: undefined,
    isDead: false,
  }));
}
