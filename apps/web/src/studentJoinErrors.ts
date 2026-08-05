import { ApiError } from "./api/errors";

export const formatStudentJoinError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "We couldn’t join the game.";
  if (!(error instanceof ApiError)) return message;
  if (error.status === 0) return `${message} Check your connection, then try again.`;
  if (error.status === 404) return `${message} Check the game code with the host.`;
  if (/nickname is already taken/i.test(message)) return `${message} Choose a different name.`;
  if (/session is full/i.test(message)) return `${message} Ask the host to make space or share another room.`;
  if (/session has already started/i.test(message)) return `${message} Ask the host for the next room.`;
  if (/session has ended/i.test(message)) return `${message} Ask the host for a new room.`;
  return message;
};
