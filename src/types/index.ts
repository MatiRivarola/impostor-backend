// Tipos compartidos entre cliente y servidor

export type OnlinePhase = 'LOBBY' | 'ASSIGNMENT' | 'DEBATE' | 'VOTING' | 'RESULT';
export type Role = 'citizen' | 'impostor';

export interface GameConfig {
  themes: string[];
  impostorCount: number;
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
}

export interface RoomData {
  code: string;         // Código de 4 caracteres
  hostId: string;       // ID del jugador host
  phase: OnlinePhase;
  players: Player[];
  secretWord: string;   // Palabra secreta del juego
  winner: 'citizens' | 'impostor' | null;
  createdAt: number;    // Timestamp de creación
  lastActivity: number; // Timestamp de última actividad
  gameConfig?: GameConfig;  // Opcional para backward compatibility
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SocketAuthData {
  roomCode: string;
  playerId: string;
}

// Eventos Socket.IO (para documentación y type safety)
export interface ServerToClientEvents {
  room_joined: (data: { room: RoomData; playerId: string }) => void;
  room_updated: (room: RoomData) => void;
  error_msg: (message: string) => void;
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
