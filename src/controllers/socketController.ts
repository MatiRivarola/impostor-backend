import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  OnlinePhase,
  VoteInfo,
} from '../types';
import * as roomService from '../services/roomService';
import * as gameService from '../services/gameService';
import * as playerService from '../services/playerService';
import * as validator from '../validators/gameValidator';
import * as timerService from '../services/timerService';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Configura todos los event handlers de Socket.IO
 */
export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // ==================== CREATE ROOM ====================
    socket.on('create_room', async ({ playerName }) => {
      try {
        // Validar nombre
        const nameValidation = validator.validatePlayerName(playerName);
        if (!nameValidation.valid) {
          socket.emit('error_msg', nameValidation.error || 'Nombre inválido');
          return;
        }

        // Crear sala
        const room = await roomService.createRoom(playerName, socket.id);

        // Unir socket a room
        socket.join(room.code);

        // Enviar confirmación al creador
        socket.emit('room_joined', {
          room,
          playerId: room.players[0].id,
        });

        console.log(
          `✅ Sala ${room.code} creada por ${playerName} (${socket.id})`
        );
      } catch (error: any) {
        console.error('❌ Error al crear sala:', error);
        socket.emit('error_msg', 'Error al crear sala');
      }
    });

    // ==================== JOIN ROOM ====================
    socket.on('join_room', async ({ code, playerName }) => {
      try {
        // Validar código
        const codeValidation = validator.validateRoomCode(code.toUpperCase());
        if (!codeValidation.valid) {
          socket.emit('error_msg', codeValidation.error || 'Código inválido');
          return;
        }

        // Validar nombre
        const nameValidation = validator.validatePlayerName(playerName);
        if (!nameValidation.valid) {
          socket.emit('error_msg', nameValidation.error || 'Nombre inválido');
          return;
        }

        // Agregar jugador a la sala
        const { room, playerId } = await roomService.addPlayerToRoom(
          code.toUpperCase(),
          playerName,
          socket.id
        );

        // Unir socket a room
        socket.join(code.toUpperCase());

        // Enviar confirmación al que se une
        socket.emit('room_joined', { room, playerId });

        // Notificar a todos en la sala
        io.to(code.toUpperCase()).emit('room_updated', room);

        console.log(`✅ ${playerName} se unió a sala ${code.toUpperCase()}`);
      } catch (error: any) {
        console.error('❌ Error al unirse a sala:', error);
        socket.emit('error_msg', error.message || 'Error al unirse a sala');
      }
    });

    // ==================== START GAME ====================
    socket.on('start_game', async ({ code, config }) => {
      try {
        const room = await roomService.getRoom(code);
        if (!room) {
          socket.emit('error_msg', 'Sala no encontrada');
          return;
        }

        // Buscar playerId del socket
        const playerId = await roomService.getPlayerIdBySocketId(
          code,
          socket.id
        );
        if (!playerId) {
          socket.emit('error_msg', 'Jugador no encontrado');
          return;
        }

        // Validar permisos
        const validation = validator.validateStartGame(room, playerId);
        if (!validation.valid) {
          socket.emit('error_msg', validation.error || 'No puedes iniciar');
          return;
        }

        // Validar configuración
        const configValidation = validator.validateGameConfig(config, room.players.length);
        if (!configValidation.valid) {
          socket.emit('error_msg', configValidation.error || 'Configuración inválida');
          return;
        }

        // ASIGNAR ROLES SERVER-SIDE con configuración
        const { players, secretWord, undercoverWord } = gameService.assignRoles(room.players, config);

        // Actualizar sala con config y resultados
        await roomService.updateRoom(code, {
          players,
          secretWord,
          undercoverWord,
          phase: 'ASSIGNMENT',
          gameConfig: config,
        });

        // Obtener sala actualizada
        const updatedRoom = await roomService.getRoom(code);
        if (!updatedRoom) return;

        // Broadcast a todos
        io.to(code).emit('room_updated', updatedRoom);

        console.log(`🎮 Juego iniciado en sala ${code} con config:`, config);
      } catch (error: any) {
        console.error('❌ Error al iniciar juego:', error);
        socket.emit('error_msg', error.message || 'Error al iniciar juego');
      }
    });

    // ==================== CHANGE PHASE ====================
    socket.on('change_phase', async ({ code, nextPhase }) => {
      try {
        const room = await roomService.getRoom(code);
        if (!room) {
          socket.emit('error_msg', 'Sala no encontrada');
          return;
        }

        const playerId = await roomService.getPlayerIdBySocketId(
          code,
          socket.id
        );
        if (!playerId) {
          socket.emit('error_msg', 'Jugador no encontrado');
          return;
        }

        // Validar permisos
        const validation = validator.validateChangePhase(
          room,
          playerId,
          nextPhase
        );
        if (!validation.valid) {
          socket.emit('error_msg', validation.error || 'No puedes cambiar fase');
          return;
        }

        // Actualizar fase
        await roomService.updateRoom(code, { phase: nextPhase });

        // Si entramos a DEBATE, iniciar timer con tiempo adaptativo
        if (nextPhase === 'DEBATE') {
          await timerService.startDebateTimer(code); // Calcula automáticamente según jugadores
        }

        // Si salimos de DEBATE, detener timer
        if (room.phase === 'DEBATE' && nextPhase !== 'DEBATE') {
          await timerService.stopDebateTimer(code);
        }

        const updatedRoom = await roomService.getRoom(code);
        if (!updatedRoom) return;

        // Broadcast
        io.to(code).emit('room_updated', updatedRoom);

        // Si entramos a VOTING, enviar estado inicial de votación
        if (nextPhase === 'VOTING') {
          const alivePlayers = room.players.filter(p => !p.isDead);
          io.to(code).emit('voting_state', {
            votes: [],
            totalVoters: alivePlayers.length,
            voteCount: 0,
          });
        }

        console.log(`📍 Fase cambiada a ${nextPhase} en sala ${code}`);
      } catch (error: any) {
        console.error('❌ Error al cambiar fase:', error);
        socket.emit('error_msg', 'Error al cambiar fase');
      }
    });

    // ==================== CAST VOTE ====================
    socket.on('cast_vote', async ({ code, votedPlayerId }) => {
      try {
        const room = await roomService.getRoom(code);
        if (!room) {
          socket.emit('error_msg', 'Sala no encontrada');
          return;
        }

        const voterId = await roomService.getPlayerIdBySocketId(code, socket.id);
        if (!voterId) return;

        const voter = room.players.find(p => p.id === voterId);
        if (!voter) return;

        // Validar voto
        const validation = validator.validateVote(room, voterId, votedPlayerId);
        if (!validation.valid) {
          socket.emit('error_msg', validation.error || 'Voto inválido');
          return;
        }

        // Guardar voto con info del votante
        await roomService.saveVote(code, voterId, voter.name, votedPlayerId);

        // NEW: Broadcast en tiempo real
        const voteInfo: VoteInfo = {
          voterId,
          voterName: voter.name,
          voterInitials: voter.name.substring(0, 2).toUpperCase(),
          votedPlayerId,
          timestamp: Date.now(),
        };

        io.to(code).emit('vote_cast', voteInfo);

        const votes = await roomService.getVotes(code);
        const alivePlayers = room.players.filter(p => !p.isDead);

        // NEW: Broadcast voting state
        const votesInfo = await roomService.getVotesInfo(code);
        io.to(code).emit('voting_state', {
          votes: votesInfo,
          totalVoters: alivePlayers.length,
          voteCount: votesInfo.length,
        });

        if (votes.size === alivePlayers.length) {
          const { victimId, winner, shouldContinue, isTie, tiedPlayers } = gameService.calculateVoteResult(votes, room.players);

          // CASO 1: EMPATE - No eliminar a nadie, limpiar votos y avisar
          if (isTie) {
            await roomService.clearVotes(code);

            // Notificar empate a todos
            io.to(code).emit('vote_tie', {
              tiedPlayers,
              message: 'Empate en la votación. Vuelvan a votar.',
            });

            // Resetear estado de votación
            io.to(code).emit('voting_state', {
              votes: [],
              totalVoters: alivePlayers.length,
              voteCount: 0,
            });

            console.log(`⚖️  EMPATE en sala ${code}. Revotación requerida.`);
            return;
          }

          // CASO 2: HAY GANADOR - Proceder con eliminación
          if (!victimId) return;

          // Marcar jugador como muerto
          await roomService.updatePlayer(code, victimId, { isDead: true });

          // Obtener datos de la víctima para la pantalla de eliminación
          const victim = room.players.find(p => p.id === victimId);
          if (!victim) return;

          if (shouldContinue) {
            // El juego continúa → ir a ELIMINATION, luego volverá a DEBATE
            await roomService.updateRoom(code, {
              phase: 'ELIMINATION',
              eliminationData: {
                victimId: victim.id,
                victimName: victim.name,
                victimRole: victim.role,
                victimAvatar: victim.avatar,
                victimColor: victim.color,
              },
            });
          } else {
            // El juego terminó → ir a RESULT
            await roomService.updateRoom(code, {
              winner,
              phase: 'RESULT',
              eliminationData: {
                victimId: victim.id,
                victimName: victim.name,
                victimRole: victim.role,
                victimAvatar: victim.avatar,
                victimColor: victim.color,
              },
            });
          }

          await roomService.clearVotes(code);

          const updatedRoom = await roomService.getRoom(code);
          if (updatedRoom) {
            io.to(code).emit('room_updated', updatedRoom);
          }

          console.log(`🏆 Votación completa en sala ${code}. ${shouldContinue ? 'Continuar juego' : `Ganador: ${winner}`}`);
        } else {
          console.log(
            `🗳️  Voto registrado en sala ${code}. ${votes.size}/${alivePlayers.length}`
          );
        }
      } catch (error: any) {
        console.error('❌ Error al votar:', error);
        socket.emit('error_msg', 'Error al votar');
      }
    });

    // ==================== RESET GAME ====================
    socket.on('reset_game', async ({ code }) => {
      try {
        const room = await roomService.getRoom(code);
        if (!room) {
          socket.emit('error_msg', 'Sala no encontrada');
          return;
        }

        const playerId = await roomService.getPlayerIdBySocketId(
          code,
          socket.id
        );
        if (!playerId) {
          socket.emit('error_msg', 'Jugador no encontrado');
          return;
        }

        // Validar permisos
        const validation = validator.validateResetGame(room, playerId);
        if (!validation.valid) {
          socket.emit('error_msg', validation.error || 'No puedes reiniciar');
          return;
        }

        // Reset jugadores
        const resetPlayers = gameService.resetPlayers(room.players);

        // Actualizar sala
        await roomService.updateRoom(code, {
          phase: 'LOBBY',
          players: resetPlayers,
          winner: null,
          secretWord: '',
          undercoverWord: '',
        });

        // Limpiar votos
        await roomService.clearVotes(code);

        const updatedRoom = await roomService.getRoom(code);
        if (!updatedRoom) return;

        // Broadcast
        io.to(code).emit('room_updated', updatedRoom);

        console.log(`🔄 Juego reiniciado en sala ${code}`);
      } catch (error: any) {
        console.error('❌ Error al reiniciar juego:', error);
        socket.emit('error_msg', 'Error al reiniciar juego');
      }
    });

    // ==================== ADD DEBATE TIME ====================
    socket.on('add_debate_time', async ({ code, seconds }) => {
      try {
        const room = await roomService.getRoom(code);
        if (!room) {
          socket.emit('error_msg', 'Sala no encontrada');
          return;
        }

        if (room.phase !== 'DEBATE') {
          socket.emit('error_msg', 'Solo se puede añadir tiempo en fase de debate');
          return;
        }

        // Añadir tiempo (típicamente 60 segundos)
        await timerService.addDebateTime(code, seconds || 60);

        const updatedRoom = await roomService.getRoom(code);
        if (!updatedRoom) return;

        // Broadcast del room actualizado
        io.to(code).emit('room_updated', updatedRoom);

        // También emitir timer_update para sincronización inmediata
        io.to(code).emit('timer_update', {
          timeRemaining: updatedRoom.debateTimeRemaining || 0,
        });

        console.log(`⏱️  ${seconds || 60}s añadidos al timer de sala ${code}`);
      } catch (error: any) {
        console.error('❌ Error al añadir tiempo:', error);
        socket.emit('error_msg', 'Error al añadir tiempo');
      }
    });

    // ==================== LEAVE ROOM ====================
    socket.on('leave_room', async ({ code }) => {
      try {
        const playerId = await roomService.getPlayerIdBySocketId(code, socket.id);
        if (!playerId) {
          socket.emit('error_msg', 'Jugador no encontrado');
          return;
        }

        const player = await roomService.getPlayerById(code, playerId);
        if (!player) return;

        // Remover jugador de la sala
        await roomService.removePlayerFromRoom(code, playerId);

        // Notificar a otros jugadores
        const updatedRoom = await roomService.getRoom(code);
        if (updatedRoom) {
          io.to(code).emit('room_updated', updatedRoom);
        }

        // Desconectar al jugador del room
        socket.leave(code);

        // Confirmar al jugador que salió
        socket.emit('room_left', { success: true });

        console.log(`👋 ${player.name} salió voluntariamente de sala ${code}`);
      } catch (error: any) {
        console.error('❌ Error al salir de sala:', error);
        socket.emit('error_msg', 'Error al salir de sala');
      }
    });

    // ==================== KICK PLAYER ====================
    socket.on('kick_player', async ({ code, playerId: targetPlayerId }) => {
      try {
        const room = await roomService.getRoom(code);
        if (!room) {
          socket.emit('error_msg', 'Sala no encontrada');
          return;
        }

        // Verificar que quien expulsa es el host
        const kickerPlayerId = await roomService.getPlayerIdBySocketId(code, socket.id);
        if (!kickerPlayerId || kickerPlayerId !== room.hostId) {
          socket.emit('error_msg', 'Solo el anfitrión puede expulsar jugadores');
          return;
        }

        // No puede expulsarse a sí mismo
        if (targetPlayerId === room.hostId) {
          socket.emit('error_msg', 'No puedes expulsarte a ti mismo');
          return;
        }

        const targetPlayer = await roomService.getPlayerById(code, targetPlayerId);
        if (!targetPlayer) {
          socket.emit('error_msg', 'Jugador no encontrado');
          return;
        }

        // Notificar al jugador expulsado
        const targetSockets = await io.in(code).fetchSockets();
        const targetSocket = targetSockets.find(s => s.id === targetPlayer.socketId);
        if (targetSocket) {
          targetSocket.emit('player_kicked', {
            message: 'Has sido expulsado de la sala por el anfitrión',
          });
          targetSocket.leave(code);
        }

        // Remover jugador de la sala
        await roomService.removePlayerFromRoom(code, targetPlayerId);

        // Notificar a otros jugadores
        const updatedRoom = await roomService.getRoom(code);
        if (updatedRoom) {
          io.to(code).emit('room_updated', updatedRoom);
        }

        console.log(`🚫 ${targetPlayer.name} fue expulsado de sala ${code} por el host`);
      } catch (error: any) {
        console.error('❌ Error al expulsar jugador:', error);
        socket.emit('error_msg', 'Error al expulsar jugador');
      }
    });

    // ==================== RECONNECT PLAYER ====================
    socket.on('reconnect_player', async ({ code, playerId }) => {
      try {
        const room = await roomService.getRoom(code);
        if (!room) {
          socket.emit('error_msg', 'Sala no encontrada');
          return;
        }

        // Verificar que el player existe
        const player = await roomService.getPlayerById(code, playerId);
        if (!player) {
          socket.emit('error_msg', 'Jugador no encontrado en esta sala');
          return;
        }

        // Verificar ventana de reconexión
        const canReconnect = await playerService.canPlayerReconnect(
          code,
          playerId
        );
        if (!canReconnect) {
          socket.emit(
            'error_msg',
            'Tiempo de reconexión expirado (5 minutos)'
          );
          return;
        }

        // Actualizar socketId del jugador
        await roomService.updateSocketMapping(code, playerId, socket.id);

        // Unir socket a room
        socket.join(code);

        // Enviar estado actual
        const updatedRoom = await roomService.getRoom(code);
        if (!updatedRoom) return;

        socket.emit('room_joined', { room: updatedRoom, playerId });

        // Notificar a todos
        io.to(code).emit('player_reconnected', {
          playerId,
          playerName: player.name,
        });

        console.log(`🔄 ${player.name} se reconectó a sala ${code}`);
      } catch (error: any) {
        console.error('❌ Error al reconectar:', error);
        socket.emit('error_msg', 'Error al reconectar');
      }
    });

    // ==================== DISCONNECT ====================
    socket.on('disconnect', async () => {
      try {
        console.log(`🔌 Cliente desconectado: ${socket.id}`);

        // Buscar en qué sala estaba el jugador
        const result = await roomService.findRoomBySocketId(socket.id);
        if (!result) return;

        const { room, playerId } = result;
        const player = await roomService.getPlayerById(room.code, playerId);
        if (!player) return;

        // Marcar como desconectado
        await playerService.markPlayerDisconnected(room.code, playerId);

        // Notificar a otros jugadores
        io.to(room.code).emit('player_disconnected', {
          playerId,
          playerName: player.name,
          canReconnect: true,
          timeWindow: 300000, // 5 min
        });

        // SI ES EL HOST → Transferir host
        if (room.hostId === playerId) {
          const connectedPlayers = await playerService.getConnectedPlayers(
            room.code
          );
          const otherPlayers = connectedPlayers.filter((p) => p.id !== playerId);

          if (otherPlayers.length > 0) {
            // Transferir a jugador más antiguo
            const newHost = otherPlayers[0];
            await playerService.transferHost(room.code, newHost.id);

            io.to(room.code).emit('host_transferred', {
              newHostId: newHost.id,
              newHostName: newHost.name,
              message: `${newHost.name} es ahora el anfitrión`,
            });

            console.log(
              `👑 Host transferido a ${newHost.name} en sala ${room.code}`
            );
          } else {
            // No hay otros jugadores conectados
            console.log(
              `⚠️  Sala ${room.code} sin jugadores conectados, esperando reconexión...`
            );
          }
        }

        // Programar eliminación del jugador en 5 min si no reconecta
        setTimeout(async () => {
          const canStillReconnect = await playerService.canPlayerReconnect(
            room.code,
            playerId
          );
          if (!canStillReconnect) {
            await roomService.removePlayerFromRoom(room.code, playerId);
            console.log(
              `🗑️  ${player.name} no reconectó, eliminado de sala ${room.code}`
            );
          }
        }, 300000); // 5 min
      } catch (error: any) {
        console.error('❌ Error al manejar desconexión:', error);
      }
    });
  });

  console.log('✅ Socket handlers configurados');
}
