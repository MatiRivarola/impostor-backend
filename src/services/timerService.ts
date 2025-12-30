import { Server } from 'socket.io';
import * as roomService from './roomService';
import { RoomData } from '../types';

const DEBATE_DURATION = 180; // 3 minutos en segundos
const TIMER_INTERVAL = 1000; // Actualizar cada segundo

let timerInterval: NodeJS.Timeout | null = null;

/**
 * Inicia el timer de debate para una sala
 */
export async function startDebateTimer(code: string, duration: number = DEBATE_DURATION): Promise<void> {
  await roomService.updateRoom(code, {
    debateTimeRemaining: duration,
    debateTimerActive: true,
  });
}

/**
 * Añade tiempo al timer de debate
 */
export async function addDebateTime(code: string, seconds: number): Promise<void> {
  const room = await roomService.getRoom(code);
  if (!room || !room.debateTimerActive) return;

  const newTime = (room.debateTimeRemaining || 0) + seconds;
  await roomService.updateRoom(code, {
    debateTimeRemaining: newTime,
  });
}

/**
 * Detiene el timer de debate
 */
export async function stopDebateTimer(code: string): Promise<void> {
  await roomService.updateRoom(code, {
    debateTimerActive: false,
  });
}

/**
 * Inicia el proceso global de timers que actualiza todas las salas activas
 */
export function startGlobalTimerProcess(io: Server): void {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(async () => {
    try {
      const activeCodes = await roomService.getAllActiveRoomCodes();

      for (const code of activeCodes) {
        const room = await roomService.getRoom(code);
        if (!room || room.phase !== 'DEBATE' || !room.debateTimerActive) continue;

        const timeRemaining = (room.debateTimeRemaining || 0) - 1;

        if (timeRemaining <= 0) {
          // Timer llegó a 0 → Impostor gana
          await roomService.updateRoom(code, {
            phase: 'RESULT',
            winner: 'impostor',
            debateTimerActive: false,
            debateTimeRemaining: 0,
          });

          const updatedRoom = await roomService.getRoom(code);
          if (updatedRoom) {
            io.to(code).emit('room_updated', updatedRoom);
            io.to(code).emit('timer_expired', {
              message: '¡Se acabó el tiempo! Los impostores ganan.',
            });
          }

          console.log(`⏰ Timer expirado en sala ${code}. Impostor gana.`);
        } else {
          // Actualizar tiempo restante
          await roomService.updateRoom(code, {
            debateTimeRemaining: timeRemaining,
          });

          // Emitir actualización a los clientes
          io.to(code).emit('timer_update', {
            timeRemaining,
          });
        }
      }
    } catch (error) {
      console.error('❌ Error en timer global:', error);
    }
  }, TIMER_INTERVAL);

  console.log('✅ Timer global iniciado');
}

/**
 * Detiene el proceso global de timers
 */
export function stopGlobalTimerProcess(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    console.log('🛑 Timer global detenido');
  }
}
