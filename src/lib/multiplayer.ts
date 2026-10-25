import type { Game, ParticipantSession, PlayerSymbol } from '../types/game.ts';

// Local storage keys
const PLAYER_NAME_STORAGE_KEY = 'duelgrid_player_name';
const SESSIONS_STORAGE_KEY = 'duelgrid_sessions';

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name.trim());
  } catch {
    // Ignore
  }
}

export function saveParticipantSession(session: ParticipantSession): void {
  try {
    const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
    const sessions: Record<string, ParticipantSession> = raw ? JSON.parse(raw) : {};
    sessions[session.gameId] = session;
    sessionStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore
  }
}

export function getLastActiveSession(): ParticipantSession | null {
  try {
    const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return null;
    const sessions: Record<string, ParticipantSession> = JSON.parse(raw);
    const keys = Object.keys(sessions);
    if (keys.length === 0) return null;
    return sessions[keys[keys.length - 1]] || null;
  } catch {
    return null;
  }
}

export function clearParticipantSession(gameId: string): void {
  try {
    const raw = sessionStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return;
    const sessions: Record<string, ParticipantSession> = JSON.parse(raw);
    delete sessions[gameId];
    sessionStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore
  }
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private isConnecting: boolean = false;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: Error) => void; timeout: any }>();
  private updateCallbacks: Set<(game: Game) => void> = new Set();
  private opponentStatusCallbacks: Set<(status: { connected: boolean; symbol?: string }) => void> = new Set();
  private connectionCallbacks: Set<(connected: boolean) => void> = new Set();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isExplicitDisconnect: boolean = false;

  private getWsUrl(): string {
    if (typeof window === 'undefined') return 'ws://localhost:3001/ws';
    const envUrl = (import.meta as any).env?.VITE_WS_URL;
    if (envUrl) return envUrl;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In Vite dev (typically 5173), we connect directly to server port 3001 or through /ws proxy
    if (window.location.port === '5173') {
      return `${protocol}//${window.location.hostname}:3001/ws`;
    }
    return `${protocol}//${window.location.host}/ws`;
  }

  public connect(): Promise<boolean> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve(this.ws.readyState === WebSocket.OPEN);
    }

    this.isExplicitDisconnect = false;
    this.isConnecting = true;

    return new Promise((resolve) => {
      try {
        const url = this.getWsUrl();
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.notifyConnectionChange(true);
          this.startHeartbeat();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.notifyConnectionChange(false);
          this.stopHeartbeat();
          if (!this.isExplicitDisconnect) {
            this.scheduleReconnect();
          }
          resolve(false);
        };

        this.ws.onerror = () => {
          this.isConnecting = false;
          this.notifyConnectionChange(false);
        };
      } catch {
        this.isConnecting = false;
        this.notifyConnectionChange(false);
        resolve(false);
      }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2500);
  }

  private notifyConnectionChange(connected: boolean) {
    for (const cb of this.connectionCallbacks) {
      cb(connected);
    }
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      const { type, payload, requestId } = msg;

      // Handle request responses
      if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(requestId)!;
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);

        if (type === 'ERROR') {
          reject(new Error(payload?.message || 'Server error'));
        } else {
          resolve(payload);
        }
        return;
      }

      // Handle server push events
      switch (type) {
        case 'GAME_UPDATE':
          if (payload?.game) {
            for (const cb of this.updateCallbacks) {
              cb(payload.game);
            }
          }
          break;

        case 'OPPONENT_STATUS':
          for (const cb of this.opponentStatusCallbacks) {
            cb(payload);
          }
          break;
      }
    } catch {
      // Ignore invalid JSON
    }
  }

  private async sendRequest<T>(type: string, payload: unknown = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const connected = await this.connect();
      if (!connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('Cannot connect to DuelGrid server. Please make sure the server is running.');
      }
    }

    const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timed out. Server did not respond.'));
        }
      }, 10000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      this.ws!.send(JSON.stringify({
        type,
        payload,
        requestId,
      }));
    });
  }

  // Authoritative API methods
  public async createRoom(playerName: string): Promise<{ game: Game; sessionToken: string; symbol: PlayerSymbol }> {
    return this.sendRequest('CREATE_ROOM', { playerName });
  }

  public async joinRoom(roomCode: string, playerName: string): Promise<{ game: Game; sessionToken: string; symbol: PlayerSymbol }> {
    return this.sendRequest('JOIN_ROOM', { roomCode, playerName });
  }

  public async reconnectGame(gameId: string, sessionToken: string): Promise<{ game: Game; symbol: PlayerSymbol }> {
    return this.sendRequest('RECONNECT', { gameId, sessionToken });
  }

  public async makeMove(gameId: string, sessionToken: string, cellIndex: number): Promise<void> {
    await this.sendRequest('MAKE_MOVE', { gameId, sessionToken, cellIndex });
  }

  public async requestRematch(gameId: string, sessionToken: string): Promise<void> {
    await this.sendRequest('REQUEST_REMATCH', { gameId, sessionToken });
  }

  public async leaveGame(gameId: string, sessionToken: string): Promise<void> {
    try {
      await this.sendRequest('LEAVE_GAME', { gameId, sessionToken });
    } catch {
      // Ignore leave errors
    }
  }

  public onGameUpdate(cb: (game: Game) => void): () => void {
    this.updateCallbacks.add(cb);
    return () => this.updateCallbacks.delete(cb);
  }

  public onOpponentStatus(cb: (status: { connected: boolean; symbol?: string }) => void): () => void {
    this.opponentStatusCallbacks.add(cb);
    return () => this.opponentStatusCallbacks.delete(cb);
  }

  public onConnectionChange(cb: (connected: boolean) => void): () => void {
    this.connectionCallbacks.add(cb);
    cb(this.isConnected());
    return () => this.connectionCallbacks.delete(cb);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getConnecting(): boolean {
    return this.isConnecting;
  }

  public disconnect(): void {
    this.isExplicitDisconnect = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const multiplayer = new MultiplayerClient();
