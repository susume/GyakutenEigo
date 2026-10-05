#requires -Version 7.0
# Generate a fictional childlike Japanese voice locally. A female source plus
# a modest pitch/formant lift keeps the chant eerie without speeding it up.
# Run from the repository root. No network service is used.
param(
  [switch]$VariantsOnly,
  [string]$VoiceName = 'Microsoft Ayumi',
  [string]$FfmpegPath,
  [double]$PitchFactor = 1.28
)
$ErrorActionPreference = 'Stop'
if ($PitchFactor -lt 1 -or $PitchFactor -gt 1.5) { throw 'PitchFactor must be between 1 and 1.5.' }
if (-not $FfmpegPath) {
  $taskFfmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($taskFfmpegCommand) { $FfmpegPath = $taskFfmpegCommand.Source }
  else {
    $FfmpegPath = @(
      "$env:USERPROFILE\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffmpeg.exe",
      "$env:USERPROFILE\AppData\Local\LINE\Data\plugin\ffmpeg\1.0.0.5\ffmpeg.exe",
      "$env:USERPROFILE\AppData\Local\Programs\LNV\Stremio-4\ffmpeg.exe"
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  }
}
if (-not $FfmpegPath -or -not (Test-Path -LiteralPath $FfmpegPath)) { throw 'Pass -FfmpegPath pointing to an existing FFmpeg executable.' }
Add-Type -AssemblyName System.Speech
$taskOutput = Join-Path (Get-Location) 'apps/web/public/assets/audio/zeus'
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskSynth.SelectVoice($VoiceName)
$taskTemp = Join-Path $taskOutput 'source-take.wav'
$taskPitch = $PitchFactor.ToString('0.#####', [Globalization.CultureInfo]::InvariantCulture)
$taskTempo = (1 / $PitchFactor).ToString('0.#####', [Globalization.CultureInfo]::InvariantCulture)
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
    $taskSynth.SetOutputToWaveFile($taskTemp, $taskFormat)
    $taskEnding = '&#12371;&#12429;&#12435;&#12384;'
    if ($taskTake.EndingRate) { $taskEnding = '<prosody rate="' + $taskTake.EndingRate + '">' + $taskEnding + '</prosody>' }
    $taskBody = '&#12384;&#12427;&#12414;&#12373;&#12435;&#12364;<break time="' + $taskTake.Pause + 'ms"/>' + $taskEnding
    if ($taskTake.Ssml) { $taskBody = $taskTake.Ssml }
    $taskSsml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP">' + $taskBody + '</speak>'
    $taskSynth.SpeakSsml($taskSsml)
    $taskSynth.SetOutputToNull()
    $taskPath = Join-Path $taskOutput ('child-' + $taskTake.Id + '.wav')
    & $FfmpegPath -hide_banner -loglevel error -y -i $taskTemp -af "asetrate=22050*$taskPitch,aresample=22050,atempo=$taskTempo,highpass=f=110,volume=0.9" -ac 1 -ar 22050 -c:a pcm_s16le $taskPath
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed for $($taskTake.Id)." }
    # Read the actual WAV data duration and update the server-owned deadline.
    $taskBytes = [IO.File]::ReadAllBytes($taskPath)
    $taskBytesPerSecond = 0
    $taskDataBytes = 0
    for ($taskOffset = 12; $taskOffset + 8 -le $taskBytes.Length;) {
      $taskChunk = [Text.Encoding]::ASCII.GetString($taskBytes, $taskOffset, 4)
      $taskChunkSize = [BitConverter]::ToUInt32($taskBytes, $taskOffset + 4)
      if ($taskChunk -eq 'fmt ') { $taskBytesPerSecond = [BitConverter]::ToUInt32($taskBytes, $taskOffset + 16) }
      if ($taskChunk -eq 'data') { $taskDataBytes = $taskChunkSize }
      $taskOffset += 8 + $taskChunkSize + ($taskChunkSize % 2)
    }
    if (-not $taskBytesPerSecond -or -not $taskDataBytes) { throw "Invalid narration WAV: $taskPath" }
    $taskDuration = [Math]::Round($taskDataBytes / $taskBytesPerSecond * 1000)
    $taskMetadataPath = Join-Path (Get-Location) 'packages/shared/src/zeusDaruma.ts'
    $taskMetadata = [IO.File]::ReadAllText($taskMetadataPath)
    $taskPattern = '(?m)(  ' + $taskTake.Id + ': \{ durationMs: )\d+(, path: ")[^"]+(" \},?)'
    $taskReplacement = '${1}' + $taskDuration + '${2}/assets/audio/zeus/child-' + $taskTake.Id + '.wav${3}'
    [IO.File]::WriteAllText($taskMetadataPath, [regex]::Replace($taskMetadata, $taskPattern, $taskReplacement), (New-Object Text.UTF8Encoding($false)))
    Write-Output "$($taskTake.Id): $taskDuration ms ($VoiceName, pitch $taskPitch)"
  }
} finally {
  $taskSynth.Dispose()
  if (Test-Path -LiteralPath $taskTemp) { Remove-Item -LiteralPath $taskTemp }
}
