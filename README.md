# Impostor Cordobés - Backend

Backend multiplayer con WebSocket para el juego "Impostor Cordobés".

## Stack Tecnológico

- **Express.js**: HTTP server
- **Socket.IO 4.7.4**: WebSocket bidireccional
- **Redis (ioredis)**: Persistencia de salas
- **TypeScript**: Type safety

## Desarrollo Local

### Requisitos
- Node.js 20+
- Docker y Docker Compose (para Redis)

### Setup

1. Instalar dependencias:
```bash
npm install
```

2. Crear archivo `.env`:
```bash
cp .env.example .env
```

3. Levantar Redis con Docker:
```bash
docker-compose up redis
```

4. En otra terminal, correr el backend:
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

## Deployment

### Railway

1. Conectar el repo a Railway
2. Agregar addon de Redis
3. Configurar variables de entorno:
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://tu-frontend.vercel.app`
4. Railway asigna automáticamente `PORT` y `REDIS_URL`

## Estructura de Carpetas

```
src/
├── index.ts                 # Entry point
├── config/
│   ├── redis.ts            # Cliente Redis
│   └── env.ts              # Validación de env vars
├── types/
│   └── index.ts            # Interfaces compartidas
├── services/
│   ├── roomService.ts      # CRUD de salas
│   ├── gameService.ts      # Lógica de juego
│   ├── playerService.ts    # Gestión de jugadores
│   └── wordService.ts      # Selección de palabras
├── controllers/
│   └── socketController.ts # Event handlers Socket.IO
└── validators/
    └── gameValidator.ts    # Validaciones
```

## Eventos Socket.IO

### Cliente → Servidor
- `create_room` - Crear sala
- `join_room` - Unirse a sala
- `start_game` - Iniciar juego (solo host)
- `change_phase` - Cambiar fase (solo host)
- `cast_vote` - Votar
- `reset_game` - Reiniciar partida (solo host)
- `reconnect_player` - Reconectar tras desconexión

### Servidor → Cliente
- `room_joined` - Confirmación de entrada a sala
- `room_updated` - Estado actualizado de la sala
- `error_msg` - Mensajes de error
- `player_disconnected` - Jugador se desconectó
- `player_reconnected` - Jugador se reconectó
- `host_transferred` - Host transferido a otro jugador
- `room_closing` - Sala próxima a cerrar

## Health Check

`GET /health` - Verifica estado del servidor y conexión a Redis

## Licencia

MIT
