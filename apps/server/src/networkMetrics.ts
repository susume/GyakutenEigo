import type { Socket } from "socket.io";

type Direction = "inbound" | "outbound";

type EventTotals = {
  messages: number;
  bytes: number;
  largestBytes: number;
};

const payloadBytes = (eventName: string, args: unknown[]) => {
  try {
    return Buffer.byteLength(JSON.stringify([eventName, ...args.filter((arg) => typeof arg !== "function")]));
  } catch {
    return 0;
  }
};

export class NetworkMetrics {
  private readonly enabled = process.env.NETWORK_DEBUG === "true";
  private readonly intervalMs = Math.max(10_000, Number(process.env.NETWORK_REPORT_INTERVAL_MS) || 60_000);
  private windowStartedAt = Date.now();
  private readonly totals: Record<Direction, Map<string, EventTotals>> = {
    inbound: new Map(),
    outbound: new Map()
  };
  private readonly transportObservations = new Map<string, number>();
  private reportTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    if (!this.enabled) return;
    this.reportTimer = setInterval(() => this.report(), this.intervalMs);
    this.reportTimer.unref();
  }

  attach(socket: Socket) {
    if (!this.enabled) return;

    socket.onAny((eventName, ...args) => this.record("inbound", eventName, args));
    socket.onAnyOutgoing((eventName, ...args) => this.record("outbound", eventName, args));

    this.recordTransport(socket.conn.transport.name);
    socket.conn.once("upgrade", (transport) => this.recordTransport(transport.name));
  }

  private record(direction: Direction, eventName: string, args: unknown[]) {
    const bytes = payloadBytes(eventName, args);
    const current = this.totals[direction].get(eventName) ?? { messages: 0, bytes: 0, largestBytes: 0 };
    current.messages += 1;
    current.bytes += bytes;
    current.largestBytes = Math.max(current.largestBytes, bytes);
    this.totals[direction].set(eventName, current);
  }

  private recordTransport(transport: string) {
    this.transportObservations.set(transport, (this.transportObservations.get(transport) ?? 0) + 1);
  }

  private report() {
    const elapsedSeconds = Math.max(1, (Date.now() - this.windowStartedAt) / 1000);
    const rows = (["inbound", "outbound"] as const).flatMap((direction) =>
      [...this.totals[direction].entries()].map(([event, totals]) => ({
        direction,
        event,
        messages: totals.messages,
        messagesPerSecond: Number((totals.messages / elapsedSeconds).toFixed(2)),
        bytes: totals.bytes,
        bytesPerSecond: Number((totals.bytes / elapsedSeconds).toFixed(2)),
        averageBytes: Math.round(totals.bytes / Math.max(1, totals.messages)),
        largestBytes: totals.largestBytes
      }))
    );
    if (rows.length === 0) {
      this.windowStartedAt = Date.now();
      return;
    }
    console.info(`[network] ${Math.round(elapsedSeconds)}s aggregate application-payload report`);
    console.info(`[network] transport observations ${JSON.stringify(Object.fromEntries(this.transportObservations))}`);
    console.table(rows);
    this.totals.inbound.clear();
    this.totals.outbound.clear();
    this.transportObservations.clear();
    this.windowStartedAt = Date.now();
  }
}
