export const AVATAR_EMOJIS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
];

export const AVATAR_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  '#06B6D4', '#A855F7', '#84CC16', '#F43F5E',
];

interface RoomAvatars {
  usedEmojis: Set<string>;
  usedColors: Set<string>;
}

const roomAvatarCache = new Map<string, RoomAvatars>();

/**
 * Asigna un avatar único (emoji + color) a un jugador en una sala
 */
export function assignPlayerAvatar(
  roomCode: string,
  existingPlayers: { avatar?: string; color?: string }[]
): { avatar: string; color: string } {
  if (!roomAvatarCache.has(roomCode)) {
    roomAvatarCache.set(roomCode, {
      usedEmojis: new Set(existingPlayers.map(p => p.avatar).filter(Boolean)),
      usedColors: new Set(existingPlayers.map(p => p.color).filter(Boolean)),
    });
  }

  const roomAvatars = roomAvatarCache.get(roomCode)!;

  // Seleccionar emoji disponible
  const availableEmojis = AVATAR_EMOJIS.filter(e => !roomAvatars.usedEmojis.has(e));
  const selectedEmoji = availableEmojis.length > 0
    ? availableEmojis[Math.floor(Math.random() * availableEmojis.length)]
    : AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];

  // Seleccionar color disponible
  const availableColors = AVATAR_COLORS.filter(c => !roomAvatars.usedColors.has(c));
  const selectedColor = availableColors.length > 0
    ? availableColors[Math.floor(Math.random() * availableColors.length)]
    : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  roomAvatars.usedEmojis.add(selectedEmoji);
  roomAvatars.usedColors.add(selectedColor);

  return { avatar: selectedEmoji, color: selectedColor };
}

/**
 * Libera el avatar de un jugador cuando sale de la sala
 */
export function releasePlayerAvatar(roomCode: string, avatar: string, color: string): void {
  const roomAvatars = roomAvatarCache.get(roomCode);
  if (roomAvatars) {
    roomAvatars.usedEmojis.delete(avatar);
    roomAvatars.usedColors.delete(color);
  }
}

/**
 * Limpia todos los avatares de una sala cuando se elimina
 */
export function clearRoomAvatars(roomCode: string): void {
  roomAvatarCache.delete(roomCode);
}
