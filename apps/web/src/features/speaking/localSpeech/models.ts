import { SPEAKCHECK_MOONSHINE } from "@quizstrike/shared";

// Weight and tokenizer sizes from the pinned Hugging Face model trees, in bytes.
export const localSpeechModels = {
  tiny: {
    id: "Xenova/whisper-tiny.en",
    revision: "79fb389fc764e7c395bd330e9531d9d32ada7049",
    bytes: 42_985_755,
    label: "Whisper Tiny English (8-bit)",
    timestamps: true
  },
  base: {
    id: "Xenova/whisper-base.en",
    revision: "95bf40a508535962c6483ead40270b2e32267508",
    bytes: 79_041_253,
    label: "Whisper Base English (8-bit)",
    timestamps: true
  },
  moonshine: {
    ...SPEAKCHECK_MOONSHINE,
    bytes: 32_079_632,
    label: "Moonshine Tiny (8-bit)",
    timestamps: false
  }
} as const;

export type LocalSpeechModel = keyof typeof localSpeechModels;
export const defaultLocalSpeechModel: LocalSpeechModel = "moonshine";
export const localSpeechCache = "speakcheck-models-v1";
export const localSpeechModelFiles = [
  "config.json", "preprocessor_config.json", "generation_config.json", "tokenizer.json",
  "tokenizer_config.json", "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"
];
export const localSpeechRuntimeBytes = 21_640_503;
