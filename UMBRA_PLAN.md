# UMBRA — Plan de Producto y Arquitectura

App de privacidad para ti y tus amigos. Estética terminal (Fira Code, fondos oscuros, prompts `>`). No se distribuye en tiendas — side-loading por APK firmado entre ustedes, TestFlight en iOS.

**Diferenciador central:** combinación de cifrado real con autenticación y pairing excéntricos (acústico, luz) en una experiencia de consola que se siente como herramienta de espía.

---

## 1. Módulos del sistema

```
┌──────────────────────────────────────────────────────────┐
│                    UMBRA CLIENT (RN)                       │
├──────────────────────────────────────────────────────────┤
│  [Vault]        [Chat]         [Pairing]   [Settings]    │
│  ✅ hecho        🔨 construir   🔨 const    ✅ existe      │
├──────────────────────────────────────────────────────────┤
│  Capa Crypto (libsodium + libsignal-react-native)        │
│  Capa Red   (WebRTC ↔ Relay fallback)                    │
│  Capa Storage (SQLite cifrado + MMKV + SecureStore)      │
└──────────────────────┬───────────────────────────────────┘
                       │ wss://  (mensajes cifrados opacos)
                       ▼
        ┌──────────────────────────────┐
        │   UMBRA RELAY (Go binary)    │
        │   VPS Hetzner/Contabo        │
        │   - Forward ciego            │
        │   - TTL 7d automático        │
        │   - WebSocket upgrade        │
        │   - ~300 LoC                 │
        └──────────────────────────────┘
```

---

## 2. Capa 1 — Identidad y Pairing

### Identidad local

- Al primer arranque, generar par de claves **Ed25519** (firma) + **X25519** (intercambio).
- Guardar en `expo-secure-store`. Fingerprint = primeros 16 bytes de SHA-256 de la public key.
- Migrar `recipientAuth.ts` (que hoy usa RSA) a X25519 + Ed25519 — más correcto para E2E y mucho más rápido.

### Pairing methods (MVP: acústico + luz)

- **Acoustic pairing** — Un dispositivo emite una secuencia de tonos FSK (Frequency Shift Keying) que codifica un bloque de 64 bytes (clave pública + nonce). El otro graba por micrófono, demodula, decodifica. Animación: osciloscopio en pantalla durante la transmisión.
- **Light-based pairing** — Pantalla del emisor parpadea con colores en un patrón que codifica los mismos bytes. El receptor usa la cámara, lee los frames, decodifica. Animación: bloques de terminal en cascada.

### Flujo de pairing

1. Alice pulsa `/pair` → elige método (acoustic o light).
2. Bob también pulsa `/pair` → modo receptor.
3. Se intercambian: `pubkey_alice`, `pubkey_bob`, nonces.
4. Cada uno deriva un canal: `HMAC-SHA256(DH(sk_alice, pk_bob), "umbra-v1")`.
5. Se guarda el contacto con alias + fingerprint.

---

## 3. Capa 2 — Cifrado

### Signal Protocol (full)

- **Double ratchet** por sesión 1:1: cada mensaje tiene clave nueva → forward secrecy.
- **Sender keys** para grupos: cuando un miembro se une, los demás le mandan su sender key cifrada con su pubkey.
- **X3DH** para handshake inicial: usar la pubkey ed25519 + un prekey bundle efímero subido al relay.
- Bindings: `@signalapp/libsignal-client` (oficial, build para RN con TurboModules), fallback a `react-native-signal-protocol`.

### Esteganografía

- LSB encoding en **PNG** (JPEG destruye LSB por su compresión).
- Pipeline: payload cifrado con Signal → bytes se esconden en LSB de los canales RGB de una foto random del carrete → la foto modificada se sube al relay como si fuera una imagen normal.
- En recepción: descarga la imagen, extrae LSB, descifra.
- Implementación: portar `stegify` (~150 LoC de LSB encode/decode) o usar `pngjs` adaptado.

### Anti-screenshot + clipboard wipe

- Android: `WindowManager.LayoutParams.FLAG_SECURE` en `MainActivity.kt`.
- iOS: detectar screenshot con `UIApplication.userDidTakeScreenshotNotification` → wipe de pantalla + log.
- Clipboard: `Clipboard.setString()` con `expirationDate` en iOS, timer + set vacío en Android.
- App switcher: en `onChange` de `AppState`, renderizar pantalla negra/LogoView cuando `appState !== "active"`.

---

## 4. Capa 3 — Red

### P2P primero, relay fallback

- **Descubrimiento:** WebSocket contra relay para hacer signaling (ofertas SDP, ICE candidates). El relay ve solo "device A quiere hablar con device B" — sin contenido.
- **Conexión directa:** WebRTC DataChannel una vez establecido. Todo el tráfico fluye P2P.
- **Fallback:** si WebRTC falla en N segundos (NAT simétrico, firewall), se cae al modo relay. Mensajes cifrados opacos van por WebSocket al relay, relay los guarda con TTL y los entrega cuando el otro se conecta.

### Prekeys

- Al instalar, generar 100 one-time prekeys X25519 y subirlas al relay (cifradas con la pubkey del usuario).
- Cuando Alice quiere escribir a Bob por primera vez sin conexión P2P aún, baja un prekey del relay y arranca el ratchet.

### Metadatos

- **Padding de tráfico:** mandar "ruido" periódico al relay para no distinguir cuándo hay mensaje real.
- **IDs rotantes:** cambiar `device_id` cada 24h.
- **Sin timestamps exactos:** el relay solo guarda fecha, no hora.

---

## 5. Capa 4 — Funcionalidades

### TTL (Time To Live) — prioridad alta

- Cada mensaje lleva `{ ttl: <segundos> }`.
- Render con cuenta regresiva visible.
- Al expirar: animación glitch de 300ms → mensaje desaparece, se borra de SQLite y se notifica al otro lado para que lo borre también.

### Burn-on-read — prioridad alta

- Estados: `unread` → `read` → `destroyed`.
- Al abrir: arranca timer de 5s (configurable) con countdown visible.
- Después: glitch animation + delete.
- El emisor recibe ack `burned` y borra su copia local.

### Shake-to-clear — prioridad baja

- `expo-sensors` Accelerometer, threshold 1.5g en 3 ejes.
- Pattern: 3 sacudidas en 2s.
- Acción: wipe del chat actual, animación de "terminal clear" (líneas cayendo).

### Comandos de chat (en vez de botones obvios)

- `/burn 30s <texto>` — mensaje que se destruye a los 30s de leído.
- `/steg <texto>` — embebe el mensaje en una imagen del carrete.
- `/canary <texto>` — manda mensaje trampa (si alguien lo abre, el emisor recibe alerta silenciosa).
- `/ttl 5m <texto>` — mensaje con TTL de 5 minutos.
- `/clear` — wipe local del chat actual.
- `/panic` — bloquea la app y requiere re-auth completa (PIN + biometría).

### Canary messages

- Se ven como mensaje normal. Al abrirse, el emisor recibe alerta silenciosa vía relay.
- Útil para saber si alguien forzó tu teléfono cuando lo dejaste solo.

### Esteganografía — prioridad alta

- Ver sección 3 (Capa 2). Disponible vía `/steg` command.

---

## 6. Capa 5 — UI / Animaciones

UI actual ya tiene:
- Fira Code en todas las fuentes
- Layout terminal con prompts `>` y timestamps `[hh:mm:ss]`
- Chat en `dm.tsx` con mensajes hardcodeados y header `<@user>`
- Contact list en `chat.tsx` con contador y filtros

### Animaciones a agregar (reanimated v4 + skia)

- **Typewriter** en cada mensaje al aparecer — `withDelay` por carácter, ~15ms/char.
- **Boot screen** al abrir el chat — simulación de arranque:
  ```
  > initializing umbra v0.1.0...
  > establishing secure channel...
  > verifying keys.................[OK]
  > loading session................[OK]
  ```
- **Cursor parpadeante** en el input (loop de 530ms).
- **Glitch de borrado** — al expirar/burn, `react-native-skia` con shader de RGB shift durante 200-300ms.
- **Scanlines sutiles** — overlay con `opacity: 0.05` y patrón horizontal en `position: absolute`.
- **Mensaje recibido** — efecto de "transmission" donde cada línea cae desde arriba con easing.
- **Pairing en vivo** — visualización osciloscopio para acoustic, bloques cayendo para light.
- **Vibration feedback** — hápticos al enviar (`Vibration.vibrate(50)`), doble al recibir, largo al burn.

---

## 7. Backend Go del Relay

```go
POST /v1/enqueue    { to: deviceId, blob: base64, ttl: hours }
GET  /v1/inbox/:id  → [{ from, blob, expires_at }]
POST /v1/ack/:id    { msgId } → borra del inbox
GET  /v1/ping       → keepalive
WS   /v1/signal     → WebRTC signaling (también opaco)
```

**Reglas duras:**

- Relay nunca ve contenido descifrado.
- Relay nunca loggea `blob` ni `from→to` en el mismo registro.
- TTL: cron que corre cada 1h y borra mensajes con `expires_at < now()`.
- Rate limit: máx 100 mensajes/día/deviceId (anti-abuso).

**Deploy:**

- Contenedor Docker en Hetzner CX22 (~$4/mes).
- TLS con Caddy automático.
- Dominio propio (ej. `relay.umbra.xyz`), pago con crypto.

---

## 8. Estructura de archivos propuesta

```
src/
├── app/
│   ├── (tabs)/
│   │   ├── chat.tsx          # lista de contactos (existe)
│   │   ├── dm.tsx            # chat individual (existe, refactor)
│   │   ├── index.tsx         # home
│   │   ├── settings.tsx
│   │   └── ...
│   └── (modals)/
│       ├── pair.tsx          # wizard de pairing
│       ├── burn.tsx          # confirmación burn
│       └── canary.tsx
├── components/
│   ├── chat/
│   │   ├── Message.tsx
│   │   ├── TypewriterText.tsx
│   │   ├── GlitchOverlay.tsx
│   │   ├── BootScreen.tsx
│   │   ├── CommandInput.tsx
│   │   └── PairingOscilloscope.tsx
│   └── ui/...
├── lib/
│   ├── crypto/                # ya existe, extender
│   │   ├── signal/            # NUEVO: libsignal client
│   │   ├── steg/              # NUEVO: LSB encode/decode
│   │   └── ...
│   ├── chat/                  # NUEVO
│   │   ├── identity.ts        # keypair, fingerprint
│   │   ├── session.ts         # double ratchet
│   │   ├── message.ts         # encrypt/decrypt envelopes
│   │   ├── commands.ts        # parser de /burn, /steg, etc.
│   │   ├── relay.ts           # cliente HTTP/WS
│   │   └── pairing/
│   │       ├── acoustic.ts    # FSK encode/decode
│   │       └── light.ts       # cámara + flash
│   └── vault/                 # ya existe
├── store/
│   ├── chat.store.ts          # NUEVO: mensajes, sesiones, contacts
│   └── ...
└── server/                     # NUEVO, repo aparte
    ├── main.go
    ├── go.mod
    ├── Dockerfile
    └── deploy/
```

---

## 9. Roadmap sugerido (12-16 semanas)

| Fase | Duración | Entregable |
|------|----------|------------|
| **0. Setup** | 1 sem | Repo del relay Go, Docker, dominio, primer deploy |
| **1. Identidad** | 1 sem | Keypairs, fingerprint, store local. Migrar `recipientAuth` a X25519 |
| **2. Pairing** | 2 sem | Acoustic + light. Visualizaciones. Flujo end-to-end con 2 devices |
| **3. Cifrado core** | 2 sem | libsignal-react-native funcionando. Mensaje cifrado entre 2 simuladores |
| **4. Relay client** | 1 sem | Cliente HTTP/WS. P2P attempt con WebRTC + fallback. Prekeys |
| **5. UI chat** | 2 sem | Refactor `dm.tsx`, typewriter, boot, scanlines, animaciones |
| **6. Funcionalidades** | 2 sem | TTL, burn, /commands, esteganografía |
| **7. Polish** | 2 sem | Anti-screenshot, clipboard wipe, shake-to-clear, canary |
| **8. Hardening** | 1 sem | Tests, manejo de errores, logs, doc para tus amigos |

---

## 10. Riesgos / decisiones pendientes

1. **libsignal en RN** — el binding oficial no es trivial. Plan B: usar `libsignal` en JNI/Java (Android) / Swift (iOS) con un bridge nativo. Plan C: implementar double ratchet custom sobre libsodium (más trabajo, más control).
2. **Esteganografía en JPEG** — JPEG destruye LSB. Forzar PNG como cover, o usar DCT-steg (mucho más complejo).
3. **WebRTC en RN** — `react-native-webrtc` existe pero tiene bugs en algunos devices. Plan B: si P2P falla siempre, ir directo a relay.
4. **Grupos con Signal** — el modelo "sender key" requiere que cada miembro distribuya su key. Complejo pero bien documentado.
5. **Audio FSK** — elegir frecuencia según el micrófono del device (rango 16-20 kHz evita que el oído lo perciba, pero algunos mics no captan tan alto).

---

## 11. Lo que NO entra al MVP

- Sincronización entre dispositivos del mismo usuario
- Llamadas de voz/video
- Compartir archivos grandes (solo steg en imágenes)
- Historial en la nube
- Notificaciones push (abrir la app manualmente)
- Duress PIN / vault señuelo (queda para una v2)

---

## 12. Stack final

**Mobile (ya instalado):**
- Expo SDK 55 + React Native 0.83
- react-native-reanimated 4.2 + react-native-skia
- react-native-quick-crypto (ya usado para vault)
- expo-secure-store, expo-sqlite, react-native-mmkv
- expo-sensors (acelerómetro)
- expo-camera, expo-av (mic + cámara para pairing)
- @gorhom/bottom-sheet
- zustand, @tanstack/react-query

**A agregar:**
- `@signalapp/libsignal-client` (cifrado)
- `react-native-webrtc` (P2P)
- `pngjs` o implementación custom (steg)
- `react-native-svg-charts` o `victory-native` (osciloscopio pairing)

**Backend:**
- Go 1.22+
- gorilla/websocket (signaling)
- SQLite embebido (inbox storage)
- Docker
- Caddy (TLS)
- Hetzner CX22 (~$4/mes) o Contabo VPS M (~$5/mes)
