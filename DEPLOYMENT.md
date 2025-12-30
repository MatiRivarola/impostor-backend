# Guía de Deployment

## Opción 1: Railway (Recomendado)

### 1. Preparar el Repositorio

1. Crear un repositorio en GitHub para el backend:
```bash
cd impostor-backend
git init
git add .
git commit -m "Initial commit: Impostor Cordobés Backend"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/impostor-backend.git
git push -u origin main
```

### 2. Configurar Railway

1. Ir a [railway.app](https://railway.app) y crear cuenta
2. Click en "New Project"
3. Seleccionar "Deploy from GitHub repo"
4. Conectar tu cuenta de GitHub y seleccionar el repo `impostor-backend`
5. Railway detectará automáticamente el Dockerfile y comenzará el build

### 3. Agregar Redis

1. En tu proyecto de Railway, click en "+ New"
2. Seleccionar "Database" → "Redis"
3. Railway creará automáticamente la variable `REDIS_URL`

### 4. Configurar Variables de Entorno

En Railway, ir a tu servicio backend → Variables:

```bash
NODE_ENV=production
CORS_ORIGIN=https://tu-frontend.vercel.app

# Estas se crean automáticamente:
# PORT (Railway lo asigna)
# REDIS_URL (del addon Redis)

# Opcionales (usar valores por defecto):
MIN_PLAYERS=3
MAX_PLAYERS=10
ROOM_TTL_ACTIVE=7200000
ROOM_TTL_INACTIVE=900000
PLAYER_RECONNECT_WINDOW=300000
```

### 5. Deploy

Railway hará deploy automáticamente. Obtendrás una URL como:
```
https://impostor-backend-production.up.railway.app
```

### 6. Verificar Health Check

```bash
curl https://impostor-backend-production.up.railway.app/health
```

Deberías ver:
```json
{
  "status": "ok",
  "redis": "connected",
  "uptime": 123.45,
  "activeRooms": 0,
  "environment": "production"
}
```

---

## Opción 2: Render

### 1. Preparar Repositorio

Igual que Railway (paso 1).

### 2. Configurar Render

1. Ir a [render.com](https://render.com) y crear cuenta
2. Click en "New +" → "Web Service"
3. Conectar GitHub repo
4. Configurar:
   - **Name**: impostor-backend
   - **Region**: Oregon (US West) - más cercano
   - **Branch**: main
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### 3. Agregar Redis

1. En Dashboard, click "New +" → "Redis"
2. Copiar la URL de Redis que te dan

### 4. Variables de Entorno

En tu Web Service → Environment:

```bash
NODE_ENV=production
REDIS_URL=tu-redis-url-de-render
CORS_ORIGIN=https://tu-frontend.vercel.app
```

---

## Configurar Frontend (Vercel)

### 1. Variable de Entorno en Vercel

1. Ir a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agregar:
   - **Name**: `VITE_SOCKET_URL`
   - **Value**: `https://impostor-backend-production.up.railway.app`
   - **Environment**: Production, Preview, Development

### 2. Redeploy

1. En Vercel, ir a Deployments
2. Click en los tres puntos del último deployment
3. Click "Redeploy"

---

## Testing en Producción

### 1. Verificar Backend

```bash
# Health check
curl https://tu-backend.up.railway.app/health

# Root endpoint
curl https://tu-backend.up.railway.app/
```

### 2. Verificar Frontend

1. Abrir tu frontend en Vercel: `https://tu-app.vercel.app`
2. Ir a "Modo Online"
3. Crear una sala
4. Abrir en otro dispositivo/navegador y unirse con el código
5. Iniciar partida y verificar que funciona

### 3. Verificar WebSocket

Abrir la consola del navegador (F12) y buscar:
```
Conectado al servidor WS: <socket-id>
```

---

## Troubleshooting

### Error: "Conectando al servidor..."

**Causa**: Frontend no puede conectarse al backend

**Solución**:
1. Verificar que `VITE_SOCKET_URL` está configurada en Vercel
2. Verificar que el backend está corriendo (health check)
3. Verificar CORS: `CORS_ORIGIN` debe coincidir con la URL de Vercel
4. Verificar logs del backend en Railway/Render

### Error: "Se perdió la conexión con el servidor"

**Causa**: Desconexión temporal o crash del backend

**Solución**:
1. Ver logs en Railway/Render
2. Verificar que Redis está activo
3. Verificar que el health check pasa

### Error: "Sala no encontrada"

**Causa**: Redis perdió los datos o expiración de TTL

**Solución**:
1. Verificar conexión a Redis
2. Aumentar `ROOM_TTL_ACTIVE` si es necesario
3. Ver logs del backend

### WebSocket no conecta desde móvil

**Causa**: Firewall o red bloqueando WebSocket

**Solución**:
1. Verificar que Railway/Render soporta WebSocket (ambos sí)
2. Probar con otra red (datos móviles vs WiFi)
3. Verificar en consola del navegador móvil

---

## Monitoreo

### Railway Dashboard

- **Metrics**: CPU, RAM, Network
- **Logs**: Ver en tiempo real
- **Health Check**: Automático cada 30s

### Render Dashboard

- **Events**: Deploy history
- **Logs**: Streaming logs
- **Metrics**: Performance básico

### Redis Monitoring

```bash
# Conectarse a Redis (Railway/Render proveen CLI)
redis-cli -u $REDIS_URL

# Ver salas activas
SMEMBERS active_rooms

# Ver datos de una sala
HGETALL room:ABCD

# Ver jugadores
HGETALL room:ABCD:players

# Ver estadísticas
INFO stats
```

---

## Costos Estimados

### Railway (Hobby Plan - Gratis)

- ✅ $5 de crédito gratis mensual
- ✅ Suficiente para ~500 horas de backend + Redis
- ✅ Ideal para proyectos pequeños/medianos

### Render (Free Tier)

- ✅ Web Service: Gratis (duerme después de 15 min de inactividad)
- ⚠️ Redis: $7/mes (mínimo)
- ⚠️ Más barato si pagas por Redis aparte

### Vercel (Hobby - Gratis)

- ✅ Frontend hosting gratis
- ✅ Builds ilimitados
- ✅ 100 GB bandwidth/mes

---

## Siguiente Nivel: Escalabilidad

Si tu juego crece y necesitas escalar:

1. **Redis Adapter para Socket.IO**: Soporta múltiples instancias del backend
2. **Load Balancer**: Distribuir tráfico entre instancias
3. **Metrics**: Prometheus + Grafana para monitoreo avanzado
4. **Database**: PostgreSQL para guardar historial de partidas
5. **CDN**: Cloudflare para cachear assets estáticos

---

## Seguridad en Producción

### Checklist

- [ ] Cambiar CORS_ORIGIN de `*` a tu dominio específico
- [ ] Agregar rate limiting (express-rate-limit)
- [ ] Validar todos los inputs (ya implementado)
- [ ] Usar HTTPS (Railway/Render lo proveen)
- [ ] No exponer logs sensibles
- [ ] Configurar timeout de salas (ya implementado)
- [ ] Revisar que no hay secrets en el código

---

## Contacto / Issues

Si tienes problemas:
1. Ver los logs del backend en Railway/Render
2. Revisar la consola del navegador (F12)
3. Verificar health check endpoint
4. Abrir issue en el repo de GitHub
