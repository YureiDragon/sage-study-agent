export interface ServerMessage {
  type: string;
  content: string;
}

export interface ClientMessage {
  type: string;
  content?: string;
  cert_id?: string;
  mode?: string;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;

  onMessage: ((msg: ServerMessage) => void) | null = null;
  onStatus: ((connected: boolean) => void) | null = null;

  constructor(url?: string) {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    this.url = url ?? `${protocol}//${location.host}/ws`;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.onStatus?.(true);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        this.onMessage?.(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.onStatus?.(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, so reconnect is handled there
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendMessage(content: string): void {
    this.send({ type: "user_message", content });
  }

  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
      this.connect();
    }, this.reconnectDelay);
  }
}
