import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./api/errors";
import { formatStudentJoinError } from "./studentJoinErrors";

test("student join errors provide cause-specific recovery guidance", () => {
  assert.equal(
    formatStudentJoinError(new ApiError("That nickname is already taken in this session.", 409)),
    "That nickname is already taken in this session. Choose a different name."
  );
  assert.equal(
    formatStudentJoinError(new ApiError("This session is full.", 400)),
    "This session is full. Ask the host to make space or share another room."
  );
  assert.equal(
    formatStudentJoinError(new ApiError("This session has already started.", 409)),
    "This session has already started. Ask the host for the next room."
  );
});

test("student join errors retain code and connection recovery guidance", () => {
  assert.equal(
    formatStudentJoinError(new ApiError("Session not found.", 404)),
    "Session not found. Check the game code with the host."
  );
  assert.equal(
    formatStudentJoinError(new ApiError("Could not reach the game server.", 0)),
    "Could not reach the game server. Check your connection, then try again."
  );
});
