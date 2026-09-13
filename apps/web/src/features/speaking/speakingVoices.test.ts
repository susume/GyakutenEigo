import assert from "node:assert/strict";
import test from "node:test";
import { getCuratedSpeakingVoices, getDefaultCuratedSpeakingVoice, isApprovedSpeakingVoiceId } from "./speakingVoices.js";

const fakeVoice = (name: string, lang: string, voiceURI = name, defaultVoice = false) => ({
  default: defaultVoice,
  lang,
  localService: true,
  name,
  voiceURI
}) as SpeechSynthesisVoice;

test("curated speaking voices expose at most one approved English provider per product profile", () => {
  const voices = [
    fakeVoice("Microsoft Jenny Online (Natural) - English (United States)", "en-US", "microsoft-jenny-natural"),
    fakeVoice("Microsoft Guy Online (Natural) - English (United States)", "en-US", "microsoft-guy-natural"),
    fakeVoice("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB", "microsoft-sonia-natural"),
    fakeVoice("Unapproved Classroom Voice", "en-US", "unapproved-classroom-voice"),
    fakeVoice("Japanese Voice", "ja-JP", "japanese-voice")
  ];

  const curated = getCuratedSpeakingVoices(voices);

  assert.deepEqual(curated.map((option) => option.preset.id), ["mika", "ken", "alex"]);
  assert.deepEqual(curated.map((option) => option.preset.displayName), ["Mika", "Ken", "Alex"]);
  assert.deepEqual(curated.map((option) => option.providerVoiceId), ["microsoft-jenny-natural", "microsoft-guy-natural", "microsoft-sonia-natural"]);
  assert.equal(isApprovedSpeakingVoiceId("unapproved-classroom-voice", voices), false);
  assert.equal(isApprovedSpeakingVoiceId("microsoft-guy-natural", voices), true);
});

test("Mika is the default when available, with a curated fallback when it is not", () => {
  const mika = fakeVoice("Google US English Female", "en-US", "google-female", true);
  const ken = fakeVoice("Google US English Male", "en-US", "google-male");
  assert.equal(getDefaultCuratedSpeakingVoice([mika, ken])?.preset.id, "mika");
  assert.equal(getDefaultCuratedSpeakingVoice([ken])?.preset.id, "ken");
  assert.equal(getDefaultCuratedSpeakingVoice([]), undefined);
});

test("natural voices win within the same approved profile", () => {
  const voices = [
    fakeVoice("Microsoft Jenny - English (United States)", "en-US", "microsoft-jenny-basic"),
    fakeVoice("Microsoft Jenny Online (Natural) - English (United States)", "en-US", "microsoft-jenny-natural")
  ];
  assert.equal(getCuratedSpeakingVoices(voices)[0]?.providerVoiceId, "microsoft-jenny-natural");
});

test("the headed Windows runtime voices resolve by exact voiceURI and keep Japanese voices out", () => {
  const voices = [
    fakeVoice("Microsoft Catherine - English (Australia)", "en-AU"),
    fakeVoice("Microsoft James - English (Australia)", "en-AU"),
    fakeVoice("Microsoft Ayumi - Japanese (Japan)", "ja-JP")
  ];
  const curated = getCuratedSpeakingVoices(voices);
  assert.deepEqual(curated.map((option) => option.providerVoiceId), [
    "Microsoft Catherine - English (Australia)",
    "Microsoft James - English (Australia)"
  ]);
  assert.equal(curated.some((option) => option.providerVoiceId.includes("Ayumi")), false);
});
