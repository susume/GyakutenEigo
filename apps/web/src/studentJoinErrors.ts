import { ApiError } from "./api/errors";

export const formatStudentJoinError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (!(error instanceof ApiError)) return message;
  if (error.status === 0) return `${message} Check your connection and try again.`;
  if (error.status === 404) return `${message} Check the code with your teacher and try again.`;
  if (/nickname is already taken/i.test(message)) return `${message} Choose a different nickname.`;
  if (/session is full/i.test(message)) return `${message} Ask the teacher to make space or join a different room.`;
  if (/session has already started/i.test(message)) return `${message} Ask the teacher for the next room.`;
  if (/session has ended/i.test(message)) return `${message} Ask the teacher for a new room.`;
  return message;
};
