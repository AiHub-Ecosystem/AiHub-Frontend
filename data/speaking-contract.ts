import aihubLimits from "./aihub-contract/limits.json";

export const MAX_SPEAKING_BYTES = aihubLimits.speakingAudioMaxBytes;
export const MAX_SPEAKING_MIB = MAX_SPEAKING_BYTES / (1024 * 1024);
export const MAX_SPEAKING_REQUEST_BYTES = 26 * 1024 * 1024;
