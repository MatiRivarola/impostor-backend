// Tipos compartidos entre cliente y servidor

export type OnlinePhase = 'LOBBY' | 'ASSIGNMENT' | 'DEBATE' | 'VOTING' | 'ELIMINATION' | 'RESULT';
export type Role = 'citizen' | 'impostor' | 'undercover';

export interface GameConfig {
  themes: string[];
  impostorCount: number;
  undercoverCount: number;
  gameMode: 'classic' | 'chaos' | 'hardcore';
}

export interface Player {
  id: string;           // UUID del jugador
  name: string;
  role: Role;
  word?: string;        // Palabra que ve el jugador (ciudadanos ven la palabra real)
  isDead: boolean;
  socketId: string;     // Socket ID actual
  lastSeen: number;     // Timestamp de última actividad (para reconexión)
  avatar: string;       // Emoji del jugador
  color: string;        // Color hexadecimal del jugador
}

export interface RoomData {
  code: string;         // Código de 4 caracteres
  hostId: string;       // ID del jugador host
  phase: OnlinePhase;
  players: Player[];
  secretWord: string;   // Palabra secreta del juego
  undercoverWord: string; // Palabra para el rol encubierto
  winner: 'citizens' | 'impostor' | null;
  createdAt: number;    // Timestamp de creación
  lastActivity: number; // Timestamp de última actividad
  gameConfig?: GameConfig;  // Opcional para backward compatibility
  eliminationData?: EliminationData; // Datos del jugador eliminado
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SocketAuthData {
  roomCode: string;
  playerId: string;
}

export interface VoteInfo {
  voterId: string;
  voterName: string;
  voterInitials: string;
  votedPlayerId: string;
  timestamp: number;
}

export interface VotingState {
  votes: VoteInfo[];
  totalVoters: number;
  voteCount: number;
}

export interface EliminationData {
  victimId: string;
  victimName: string;
  victimRole: Role;
  victimAvatar?: string;
  victimColor?: string;
}

// Eventos Socket.IO (para documentación y type safety)
export interface ServerToClientEvents {
  room_joined: (data: { room: RoomData; playerId: string }) => void;
  room_updated: (room: RoomData) => void;
  error_msg: (message: string) => void;

  // Real-time voting events
  vote_cast: (data: VoteInfo) => void;
  voting_state: (data: VotingState) => void;

  player_disconnected: (data: {
    playerId: string;
    playerName: string;
    canReconnect: boolean;
    timeWindow: number;
  }) => void;
  player_reconnected: (data: { playerId: string; playerName: string }) => void;
  host_transferred: (data: {
    newHostId: string;
    newHostName: string;
    message: string
  }) => void;
  room_closing: (data: { reason: string; timeRemaining: number }) => void;
}

export interface ClientToServerEvents {
  create_room: (data: { playerName: string }) => void;
  join_room: (data: { code: string; playerName: string }) => void;
  start_game: (data: { code: string; config: GameConfig }) => void;
  change_phase: (data: { code: string; nextPhase: OnlinePhase }) => void;
  cast_vote: (data: { code: string; votedPlayerId: string }) => void;
  reset_game: (data: { code: string }) => void;
  reconnect_player: (data: { code: string; playerId: string }) => void;
}
