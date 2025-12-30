// Servicio de selección de palabras para el juego (versión backend)

interface WordPair {
  normal: string;      // Palabra que ven los ciudadanos
  undercover: string;  // Palabra que vería un encubierto (no usado en modo impostor)
}

// Pool simplificado de palabras (subset del frontend)
const WORD_LISTS: Record<string, WordPair[]> = {
  argentina: [
    { normal: 'Mate', undercover: 'Té' },
    { normal: 'Fernet', undercover: 'Coca' },
    { normal: 'Asado', undercover: 'Parrilla' },
    { normal: 'Empanada', undercover: 'Tarta' },
    { normal: 'Dulce de Leche', undercover: 'Miel' },
    { normal: 'Choripán', undercover: 'Pancho' },
    { normal: 'Tango', undercover: 'Baile' },
    { normal: 'Diego', undercover: 'Messi' },
    { normal: 'Gaucho', undercover: 'Vaquero' },
    { normal: 'Colectivo', undercover: 'Bondi' },
    { normal: 'Che', undercover: 'Vos' },
    { normal: 'Ñoquis', undercover: 'Papas' },
    { normal: 'Alfajor', undercover: 'Oreo' },
    { normal: 'Birome', undercover: 'Lapicera' },
    { normal: 'Pibe', undercover: 'Pendejo' },
  ],
  cordoba: [
    { normal: 'Cuarteto', undercover: 'Cumbia' },
    { normal: 'Fernet con Coca', undercover: 'Cuba Libre' },
    { normal: 'Peperina', undercover: 'Menta' },
    { normal: 'La Mona', undercover: 'Cantante' },
    { normal: 'Fariña', undercover: 'Harina' },
    { normal: 'Culiau', undercover: 'Amigo' },
    { normal: 'Quesillo', undercover: 'Queso' },
    { normal: 'Sierras', undercover: 'Montañas' },
    { normal: 'Marquesita', undercover: 'Pan' },
    { normal: 'Patio de la Cañada', undercover: 'Plaza' },
    { normal: 'Calle Nueve', undercover: 'Calle Diez' },
    { normal: 'Balvanera', undercover: 'Barrio' },
    { normal: 'Caracol', undercover: 'Shopping' },
    { normal: 'Patio Olmos', undercover: 'Mall' },
    { normal: 'River', undercover: 'Instituto' },
  ],
  comida: [
    { normal: 'Pizza', undercover: 'Focaccia' },
    { normal: 'Milanesa', undercover: 'Suprema' },
    { normal: 'Ravioles', undercover: 'Ñoquis' },
    { normal: 'Locro', undercover: 'Guiso' },
    { normal: 'Humita', undercover: 'Tamal' },
    { normal: 'Torta Frita', undercover: 'Sopaipilla' },
    { normal: 'Chimichurri', undercover: 'Salsa Verde' },
    { normal: 'Carbonada', undercover: 'Puchero' },
    { normal: 'Sorrentinos', undercover: 'Canelones' },
    { normal: 'Fugazzeta', undercover: 'Pizza con Cebolla' },
  ],
  futbol: [
    { normal: 'Boca', undercover: 'River' },
    { normal: 'Messi', undercover: 'Ronaldo' },
    { normal: 'Copa Libertadores', undercover: 'Champions' },
    { normal: 'Pelota', undercover: 'Balón' },
    { normal: 'Cancha', undercover: 'Estadio' },
    { normal: 'Árbitro', undercover: 'Juez' },
    { normal: 'Gol', undercover: 'Tanto' },
    { normal: 'Penal', undercover: 'Tiro Libre' },
    { normal: 'Offside', undercover: 'Adelantado' },
    { normal: 'Gambeta', undercover: 'Bicicleta' },
  ],
};

/**
 * Obtiene una palabra aleatoria del pool seleccionado
 * @param selectedThemeIds - IDs de temas seleccionados (ej: ['argentina', 'cordoba'])
 * @returns Palabra secreta para el juego
 */
export function getGameWords(selectedThemeIds: string[]): {
  secretWord: string;
  undercoverWord: string;
  themeLabel: string;
} {
  // 1. Combinar listas de todos los temas seleccionados
  let pool: { pair: WordPair; themeId: string }[] = [];

  selectedThemeIds.forEach((themeId) => {
    if (WORD_LISTS[themeId]) {
      WORD_LISTS[themeId].forEach((pair) => {
        pool.push({ pair, themeId });
      });
    }
  });

  // Fallback: si el pool está vacío, usar Argentina
  if (pool.length === 0) {
    WORD_LISTS['argentina'].forEach((pair) =>
      pool.push({ pair, themeId: 'argentina' })
    );
  }

  // 2. Seleccionar palabra aleatoria
  const selection = pool[Math.floor(Math.random() * pool.length)];

  return {
    secretWord: selection.pair.normal,
    undercoverWord: selection.pair.undercover,
    themeLabel: selection.themeId,
  };
}

/**
 * Genera un código de sala único de 4 caracteres
 * Usa caracteres sin ambigüedad (sin O/0, I/1)
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin O, 0, I, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
