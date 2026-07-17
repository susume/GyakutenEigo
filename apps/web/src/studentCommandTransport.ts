import type { Socket } from "socket.io-client";

export type StudentCommandAck<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export class StudentCommandTransportError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
    this.name = "StudentCommandTransportError";
  }
}

const SOCKET_COMMAND_TIMEOUT_MS = 3_000;

export async function sendStudentCommand<T>(
  socket: Socket | null,
  event: string,
  payload: unknown,
  httpFallback: () => Promise<T>
): Promise<T> {
  if (!socket?.connected) return httpFallback();

  let response: StudentCommandAck<T>;
  try {
    response = await socket.timeout(SOCKET_COMMAND_TIMEOUT_MS).emitWithAck(event, payload) as StudentCommandAck<T>;
  } catch {
    // A timed-out command may already have reached the server. Do not retry a
    // purchase over HTTP because that could charge the student twice.
    throw new StudentCommandTransportError("The game connection is delayed. Your action may still complete; please wait a moment.");
  }

  if (!response || response.ok !== true) {
    throw new StudentCommandTransportError(
      response?.error ?? "The game server could not complete that action.",
      response?.status ?? 0
    );
  }

  return response.data;
}
