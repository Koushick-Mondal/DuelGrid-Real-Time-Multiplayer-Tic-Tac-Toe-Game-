import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GameServerEngine } from './gameServer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const PORT = parseInt(process.env.PORT || '3001', 10);
const engine = new GameServerEngine();

// Map to track which WebSockets are in which room
// key: WebSocket, value: { roomCode: string, token: string, symbol: 'X' | 'O' }
const socketMetadata = new Map<WebSocket, { roomCode: string; token: string; symbol: 'X' | 'O' }>();

// Map to track active sockets per room: roomCode -> Set<WebSocket>
const roomSockets = new Map<string, Set<WebSocket>>();

function registerSocketToRoom(ws: WebSocket, roomCode: string, token: string, symbol: 'X' | 'O') {
  socketMetadata.set(ws, { roomCode, token, symbol });
  if (!roomSockets.has(roomCode)) {
    roomSockets.set(roomCode, new Set());
  }
  roomSockets.get(roomCode)!.add(ws);
}

function unregisterSocket(ws: WebSocket) {
  const meta = socketMetadata.get(ws);
  if (meta) {
    const sockets = roomSockets.get(meta.roomCode);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        roomSockets.delete(meta.roomCode);
      } else {
        // Notify other player that opponent disconnected
        broadcastToRoom(meta.roomCode, {
          type: 'OPPONENT_STATUS',
          payload: { connected: false, symbol: meta.symbol },
        });
      }
    }
    socketMetadata.delete(ws);
  }
}

function broadcastToRoom(roomCode: string, message: unknown, excludeWs?: WebSocket) {
  const sockets = roomSockets.get(roomCode);
  if (!sockets) return;

  const json = JSON.stringify(message);
  for (const client of sockets) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// MIME types for static file serving
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Create HTTP Server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Health Endpoint
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      activeRooms: engine.getActiveRoomCount(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Serve static files in production if dist/ exists
  if (fs.existsSync(DIST_DIR)) {
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url || 'index.html');
    if (!fs.existsSync(filePath)) {
      // SPA Fallback
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DuelGrid Multiplayer Server is running.');
});

// Create WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  let isAlive = true;

  ws.on('pong', () => {
    isAlive = true;
  });

  ws.on('message', (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, payload, requestId } = msg;

      const reply = (resType: string, resPayload: unknown) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: resType, payload: resPayload, requestId }));
        }
      };

      const replyError = (errorMessage: string, code?: string) => {
        reply('ERROR', { message: errorMessage, code });
      };

      switch (type) {
        case 'PING': {
          reply('PONG', { time: Date.now() });
          break;
        }

        case 'CREATE_ROOM': {
          try {
            const { playerName } = payload;
            const result = engine.createRoom(playerName);
            registerSocketToRoom(ws, result.game.room_code, result.sessionToken, result.symbol);
            reply('ROOM_CREATED', result);
          } catch (err: unknown) {
            replyError(err instanceof Error ? err.message : 'Failed to create room.');
          }
          break;
        }

        case 'JOIN_ROOM': {
          try {
            const { roomCode, playerName } = payload;
            const result = engine.joinRoom(roomCode, playerName);
            registerSocketToRoom(ws, result.game.room_code, result.sessionToken, result.symbol);
            reply('ROOM_JOINED', result);

            // Broadcast to room that opponent joined and game is in progress
            broadcastToRoom(result.game.room_code, {
              type: 'GAME_UPDATE',
              payload: { game: result.game },
            });
          } catch (err: unknown) {
            replyError(err instanceof Error ? err.message : 'Failed to join room.');
          }
          break;
        }

        case 'RECONNECT': {
          try {
            const { gameId, sessionToken } = payload;
            const result = engine.reconnect(gameId, sessionToken);
            registerSocketToRoom(ws, result.game.room_code, sessionToken, result.symbol);
            reply('RECONNECTED', result);

            // Notify opponent of reconnection
            broadcastToRoom(result.game.room_code, {
              type: 'OPPONENT_STATUS',
              payload: { connected: true, symbol: result.symbol },
            }, ws);
          } catch (err: unknown) {
            replyError(err instanceof Error ? err.message : 'Failed to reconnect.');
          }
          break;
        }

        case 'MAKE_MOVE': {
          try {
            const { gameId, sessionToken, cellIndex } = payload;
            const updatedGame = engine.makeMove(gameId, sessionToken, cellIndex);

            // Broadcast authoritative game state to all room participants
            broadcastToRoom(updatedGame.room_code, {
              type: 'GAME_UPDATE',
              payload: { game: updatedGame },
            });
          } catch (err: unknown) {
            replyError(err instanceof Error ? err.message : 'Invalid move.');
          }
          break;
        }

        case 'REQUEST_REMATCH': {
          try {
            const { gameId, sessionToken } = payload;
            const result = engine.requestRematch(gameId, sessionToken);

            // Broadcast rematch state to room
            broadcastToRoom(result.game.room_code, {
              type: 'GAME_UPDATE',
              payload: { game: result.game },
            });
          } catch (err: unknown) {
            replyError(err instanceof Error ? err.message : 'Failed to request rematch.');
          }
          break;
        }

        case 'LEAVE_GAME': {
          try {
            const { gameId, sessionToken } = payload;
            const updatedGame = engine.leaveGame(gameId, sessionToken);

            broadcastToRoom(updatedGame.room_code, {
              type: 'GAME_UPDATE',
              payload: { game: updatedGame },
            });

            unregisterSocket(ws);
          } catch (err: unknown) {
            replyError(err instanceof Error ? err.message : 'Failed to leave game.');
          }
          break;
        }

        default:
          replyError(`Unknown message type: ${type}`);
      }
    } catch {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Malformed JSON payload' } }));
      }
    }
  });

  ws.on('close', () => {
    unregisterSocket(ws);
  });

  ws.on('error', () => {
    unregisterSocket(ws);
  });
});

// Periodic heartbeat & room cleanup
const interval = setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  }
  engine.cleanupExpiredRooms();
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

server.listen(PORT, () => {
  console.log(`[DuelGrid Server] Authoritative WebSocket server listening on port ${PORT}`);
});
