import { ApiError } from "./api/errors";

export const formatStudentJoinError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "We couldn’t join the game.";
  if (!(error instanceof ApiError)) return message;
  if (error.status === 0 && error.kind === "timeout") {
    return "The game server is taking too long to respond. It may be waking up. Wait a few seconds, then try again.";
  }
  if (error.status === 0) {
    return "We can open QuizStrike, but this network cannot reach the game server. Try again, or ask your teacher for help.";
  }
  if (error.status === 502 || error.status === 503 || error.status === 504 || error.kind === "server") {
    return "The game server is waking up or temporarily unavailable. Wait a few seconds, then try again.";
  }
  if (/nickname is already taken/i.test(message)) return `${message} Choose a different name.`;
  if (/session is full/i.test(message)) return `${message} Ask the host to make space or share another room.`;
  if (/session has already started/i.test(message)) return `${message} Ask the host for the next room.`;
  if (/session has ended/i.test(message)) return `${message} Ask the host for a new room.`;
  if (error.status === 404 && /session|game|code/i.test(message)) {
    return "That game code was not found. Check the code with your teacher, then try again.";
  }
  if (error.status === 400 && /session|game code|code/i.test(message)) {
    return "That game code is not valid. Check the 6-character code with your teacher.";
  }
  return message;
};
