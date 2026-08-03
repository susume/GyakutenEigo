export const PROTOCOL_VERSION = 1 as const;
export const MIN_SUPPORTED_PROTOCOL_VERSION = 1 as const;
export const MAX_SUPPORTED_PROTOCOL_VERSION = PROTOCOL_VERSION;

/**
 * Version 0 represents the pre-handshake Socket.IO transport. It is accepted
 * only by the server-side rollout adapter and is not a canonical protocol.
 */
export const LEGACY_PROTOCOL_VERSION = 0 as const;
export const MAX_PROTOCOL_MESSAGE_BYTES = 16 * 1024;

export const PROTOCOL_TIMESTAMP_UNIT = "unix_epoch_milliseconds" as const;

