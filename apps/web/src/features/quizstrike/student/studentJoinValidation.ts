const blockedNicknameTerms = [
  "admin",
  "teacher",
  "moderator",
  "damn",
  "hell",
  "crap",
  "shit",
  "fuck",
  "bitch",
  "asshole",
  "sex",
  "porn",
  "nazi",
  "hitler"
];

export const getNicknameError = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return "";
  return blockedNicknameTerms.some((term) => normalized.includes(term)) ? "Choose another player name." : "";
};

export const validateStudentJoin = (code: string, nickname: string) => {
  const normalizedCode = code.trim().toUpperCase();
  const normalizedNickname = nickname.trim();
  const nicknameError = getNicknameError(normalizedNickname);
  const error = nicknameError
    || (normalizedCode.length !== 6 ? "Enter the 6-character game code." : "")
    || (!normalizedNickname ? "Enter a player name." : "");
  return { code: normalizedCode, nickname: normalizedNickname, error };
};
