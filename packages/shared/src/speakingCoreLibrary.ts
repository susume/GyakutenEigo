import { SCHOOL_ENGLISH_LIBRARY, type SpeakingCoreLibraryItem } from "./speakingSchoolLibrary.js";
import { WORKPLACE_ENGLISH_LIBRARY } from "./speakingWorkplaceLibrary.js";

export type { SpeakingCoreLibraryItem } from "./speakingSchoolLibrary.js";
export { SCHOOL_ENGLISH_LIBRARY } from "./speakingSchoolLibrary.js";
export { WORKPLACE_ENGLISH_LIBRARY } from "./speakingWorkplaceLibrary.js";

/**
 * Canonical built-in catalog. Keep this export stable: the server templates
 * endpoint and the web compatibility fallback both consume it.
 */
export const SPEAKING_CORE_LIBRARY: SpeakingCoreLibraryItem[] = [
  ...SCHOOL_ENGLISH_LIBRARY,
  ...WORKPLACE_ENGLISH_LIBRARY
];

