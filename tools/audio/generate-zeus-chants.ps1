# Generate the bundled Japanese narration with an installed Windows voice.
# Run from the repository root. No network service is used.
Add-Type -AssemblyName System.Speech
$taskOutput = Join-Path (Get-Location) 'apps/web/public/assets/audio/zeus'
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskSynth.SelectVoice('Microsoft Ichiro')
$taskFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$taskTakes = @(
  @{ Id = 'slow'; Rate = -5; Pause = 650 },
  @{ Id = 'steady'; Rate = -3; Pause = 400 },
  @{ Id = 'quick'; Rate = -1; Pause = 200 }
)
try {
  foreach ($taskTake in $taskTakes) {
    $taskSynth.Rate = $taskTake.Rate
    $taskSynth.SetOutputToWaveFile((Join-Path $taskOutput ($taskTake.Id + '.wav')), $taskFormat)
    $taskSsml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP">&#12384;&#12427;&#12414;&#12373;&#12435;&#12364;<break time="' + $taskTake.Pause + 'ms"/>&#12371;&#12429;&#12435;&#12384;</speak>'
    $taskSynth.SpeakSsml($taskSsml)
    $taskSynth.SetOutputToNull()
  }
} finally { $taskSynth.Dispose() }
