# Generate the bundled Japanese narration with an installed Windows voice.
# Run from the repository root. No network service is used.
param([switch]$VariantsOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskOutput = Join-Path (Get-Location) 'apps/web/public/assets/audio/zeus'
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskSynth.SelectVoice('Microsoft Ichiro')
$taskFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$taskTakes = @(
  @{ Id = 'slow'; Rate = -5; Pause = 650 },
  @{ Id = 'steady'; Rate = -3; Pause = 400 },
  @{ Id = 'quick'; Rate = -1; Pause = 200 },
  @{ Id = 'rush'; Rate = -5; Pause = 120; EndingRate = '+50%' },
  @{ Id = 'suspense'; Rate = -1; Pause = 1500; EndingRate = '-30%' },
  @{ Id = 'staccato'; Rate = -2; Ssml = '&#12384;&#12427;&#12414;<break time="250ms"/>&#12373;&#12435;&#12364;<break time="550ms"/>&#12371;&#12429;&#12435;<break time="180ms"/>&#12384;' }
)
try {
  foreach ($taskTake in $taskTakes) {
    if ($VariantsOnly -and $taskTake.Id -in @('slow', 'steady', 'quick')) { continue }
    $taskSynth.Rate = $taskTake.Rate
    $taskSynth.SetOutputToWaveFile((Join-Path $taskOutput ($taskTake.Id + '.wav')), $taskFormat)
    $taskEnding = '&#12371;&#12429;&#12435;&#12384;'
    if ($taskTake.EndingRate) { $taskEnding = '<prosody rate="' + $taskTake.EndingRate + '">' + $taskEnding + '</prosody>' }
    $taskBody = '&#12384;&#12427;&#12414;&#12373;&#12435;&#12364;<break time="' + $taskTake.Pause + 'ms"/>' + $taskEnding
    if ($taskTake.Ssml) { $taskBody = $taskTake.Ssml }
    $taskSsml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP">' + $taskBody + '</speak>'
    $taskSynth.SpeakSsml($taskSsml)
    $taskSynth.SetOutputToNull()
  }
} finally { $taskSynth.Dispose() }
