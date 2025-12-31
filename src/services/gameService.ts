import { Player, OnlinePhase, GameConfig } from '../types';
import { getGameWords } from './wordService';

/**
 * Asigna roles y palabras a los jugadores (server-side)
 * Los ciudadanos ven la palabra secreta, undercover ve palabra similar, impostor NO ve nada
 */
export function assignRoles(
  players: Player[],
  config: GameConfig
): { players: Player[]; secretWord: string; undercoverWord: string } {
  if (players.length < 2) {
    throw new Error('Se necesitan al menos 2 jugadores');
  }

  // Validar configuración
  const maxImpostors = Math.floor(players.length / 2);
  if (config.impostorCount < 1 || config.impostorCount > maxImpostors) {
    throw new Error(`Número de impostores inválido (1-${maxImpostors})`);
  }

  // 1. Obtener palabras usando temas configurados
  const { secretWord, undercoverWord } = getGameWords(config.themes);

  const undercoverCount = config.undercoverCount || 0;
  const totalSpecialRoles = config.impostorCount + undercoverCount;

  if (totalSpecialRoles >= players.length) {
    throw new Error('Debe haber al menos 1 ciudadano');
  }

  // 2. Mezclar jugadores aleatoriamente (orden de arranque)
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

  // 3. Seleccionar roles aleatoriamente del orden mezclado
  const impostorIds = new Set(
    shuffledPlayers.slice(0, config.impostorCount).map(p => p.id)
  );

  const undercoverIds = new Set(
    shuffledPlayers.slice(config.impostorCount, config.impostorCount + undercoverCount).map(p => p.id)
  );

  // 4. Asignar roles y palabras manteniendo el orden aleatorio
  const updatedPlayers = shuffledPlayers.map((player) => {
    if (impostorIds.has(player.id)) {
      // Impostor: NO ve la palabra
      return {
        ...player,
        role: 'impostor' as const,
        word: undefined,
        isDead: false,
      };
    } else if (undercoverIds.has(player.id)) {
      // Undercover: ve palabra similar
      return {
        ...player,
        role: 'undercover' as const,
        word: undercoverWord,
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

  console.log(`🎮 Roles: ${config.impostorCount} impostor(es), ${undercoverCount} undercover`);
  console.log(`📝 Palabra secreta: "${secretWord}" | Undercover: "${undercoverWord}"`);
  console.log(`🎨 Temas: ${config.themes.join(', ')}`);
  console.log(`🔀 Orden de jugadores mezclado: ${updatedPlayers.map(p => p.name).join(', ')}`);

  return {
    players: updatedPlayers,
    secretWord,
    undercoverWord,
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
    VOTING: ['ELIMINATION', 'RESULT'],
    ELIMINATION: ['DEBATE', 'RESULT'],
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
  victimId: string | null;
  winner: 'citizens' | 'impostor' | null;
  shouldContinue: boolean;
  voteCounts: Map<string, number>;
  isTie: boolean;
  tiedPlayers: string[];
} {
  // Contar votos
  const voteCounts = new Map<string, number>();

  for (const votedId of votes.values()) {
    voteCounts.set(votedId, (voteCounts.get(votedId) || 0) + 1);
  }

  // Encontrar al más votado y detectar empates
  let maxVotes = 0;
  const playersWithMaxVotes: string[] = [];

  for (const [playerId, count] of voteCounts.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      playersWithMaxVotes.length = 0;
      playersWithMaxVotes.push(playerId);
    } else if (count === maxVotes && count > 0) {
      playersWithMaxVotes.push(playerId);
    }
  }

  // Detectar empate
  const isTie = playersWithMaxVotes.length > 1;

  // Si hay empate, NO eliminar a nadie
  if (isTie) {
    console.log(`⚖️  EMPATE: ${playersWithMaxVotes.length} jugadores empatados con ${maxVotes} votos cada uno`);
    return {
      victimId: null,
      winner: null,
      shouldContinue: true,
      voteCounts,
      isTie: true,
      tiedPlayers: playersWithMaxVotes,
    };
  }

  // Si nadie tiene votos, decidir aleatoriamente entre jugadores vivos
  let victimId = playersWithMaxVotes[0] || '';
  if (!victimId) {
    const alivePlayers = players.filter((p) => !p.isDead);
    victimId = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
  }

  const victim = players.find((p) => p.id === victimId);
  if (!victim) {
    throw new Error('Víctima no encontrada');
  }

  // Simular muerte de la víctima para calcular condiciones de victoria
  const updatedPlayers = players.map(p =>
    p.id === victimId ? { ...p, isDead: true } : p
  );

  const livingPlayers = updatedPlayers.filter(p => !p.isDead);
  const livingImpostors = updatedPlayers.filter(p => !p.isDead && p.role === 'impostor');
  const livingCitizens = updatedPlayers.filter(p => !p.isDead && p.role !== 'impostor');

  let winner: 'citizens' | 'impostor' | null = null;
  let shouldContinue = true;

  if (victim.role === 'impostor') {
    // Eliminaron a un impostor
    if (livingImpostors.length === 0) {
      // Todos los impostores eliminados → Ciudadanos ganan
      winner = 'citizens';
      shouldContinue = false;
    } else {
      // Todavía hay impostores → Continuar
      shouldContinue = true;
    }
  } else {
    // Eliminaron a un ciudadano o undercover
    if (livingPlayers.length <= 2) {
      // Quedan 2 o menos jugadores → Impostor gana
      winner = 'impostor';
      shouldContinue = false;
    } else if (livingImpostors.length >= livingCitizens.length) {
      // Impostores igualan o superan a ciudadanos → Impostor gana
      winner = 'impostor';
      shouldContinue = false;
    } else {
      // El juego continúa
      shouldContinue = true;
    }
  }

  console.log(
    `🗳️  Resultado: ${victim.name} eliminado (${victim.role}). ` +
    `Vivos: ${livingPlayers.length} (${livingImpostors.length} impostores). ` +
    `${shouldContinue ? 'Continuar' : `Ganador: ${winner}`}`
  );

  return {
    victimId,
    winner,
    shouldContinue,
    voteCounts,
    isTie: false,
    tiedPlayers: [],
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
