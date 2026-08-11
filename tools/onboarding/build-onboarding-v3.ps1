[CmdletBinding()]
param(
  [string]$OutputPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$outputRoot = Join-Path $PSScriptRoot "output"
$validationRoot = Join-Path $outputRoot "validation-v3"
$tempRoot = Join-Path $outputRoot ("build-temp-v3-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $workspaceRoot "quizstrike-teacher-onboarding-v3.mp4"
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$outputCopy = Join-Path $outputRoot "quizstrike-teacher-onboarding-v3.mp4"

New-Item -ItemType Directory -Force -Path $outputRoot, $validationRoot, $tempRoot | Out-Null

function Resolve-Tool {
  param([string[]]$Candidates, [string]$Name)

  foreach ($candidate in $Candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw "Could not find $Name."
}

$ffmpeg = Resolve-Tool @(
  "C:\Users\hungb\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffmpeg.exe",
  "C:\Users\hungb\AppData\Local\LINE\Data\plugin\ffmpeg\1.0.0.5\ffmpeg.exe",
  "C:\Users\hungb\AppData\Local\Programs\LNV\Stremio-4\ffmpeg.exe"
) "ffmpeg"
$ffprobe = Resolve-Tool @(
  "C:\Users\hungb\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffprobe.exe",
  "C:\Users\hungb\AppData\Local\LINE\Data\plugin\ffmpeg\1.0.0.5\ffprobe.exe",
  "C:\Users\hungb\AppData\Local\Programs\LNV\Stremio-4\ffprobe.exe"
) "ffprobe"

$logo = Join-Path $workspaceRoot "apps\web\public\assets\quizstrike-classroom-logo.png"
$click = Join-Path $workspaceRoot "apps\web\public\assets\audio\kenney\click1.ogg"
$click2 = Join-Path $workspaceRoot "apps\web\public\assets\audio\kenney\click2.ogg"
$bell = Join-Path $workspaceRoot "apps\web\public\assets\audio\kenney\impactBell_heavy_000.ogg"
$rawRoot = Join-Path $PSScriptRoot "raw"
$raw = @{
  account = Join-Path $rawRoot "01-account.webm"
  quiz = Join-Path $rawRoot "02-make-quiz.webm"
  game = Join-Path $rawRoot "03-create-game.webm"
  invite = Join-Path $rawRoot "04-invite-students.webm"
  student = Join-Path $rawRoot "student-join.webm"
  start = Join-Path $rawRoot "05-start-game.webm"
}

foreach ($asset in @($logo, $click, $click2, $bell) + $raw.Values) {
  if (-not (Test-Path -LiteralPath $asset)) { throw "Required asset is missing: $asset" }
}

$culture = [Globalization.CultureInfo]::InvariantCulture
$videoEncoder = "libx264"
$videoOptions = @("-preset", "medium", "-crf", "18")
$commonVideoFilter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071226,setsar=1,fps=30"

$fontFile = if (Test-Path -LiteralPath "C:\Windows\Fonts\arialbd.ttf") {
  "C:\Windows\Fonts\arialbd.ttf"
} elseif (Test-Path -LiteralPath "C:\Windows\Fonts\segoeuib.ttf") {
  "C:\Windows\Fonts\segoeuib.ttf"
} else {
  "C:\Windows\Fonts\arial.ttf"
}
$fontFilterPath = (($fontFile -replace "\\", "/") -replace ":", "\:")

function Format-Seconds {
  param([double]$Value)
  return $Value.ToString("0.000", $culture)
}

function Escape-DrawText {
  param([string]$Value)
  return $Value.Replace("\", "\\").Replace(":", "\:").Replace("'", "\'").Replace(",", "\,").Replace(";", "\;")
}

function Invoke-Ffmpeg {
  param([string[]]$Arguments)

  $errorLog = Join-Path $tempRoot "ffmpeg-error.log"
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $null = & $ffmpeg @Arguments 2> $errorLog
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorAction
  if ($exitCode -ne 0) {
    $details = (Get-Content -LiteralPath $errorLog -Raw -ErrorAction SilentlyContinue).Trim()
    throw "ffmpeg failed with exit code $exitCode. $details Arguments: $($Arguments -join ' ')"
  }
}

function Get-Duration {
  param([string]$Path)
  $rawValue = & $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $Path 2>$null
  if ($LASTEXITCODE -ne 0) { throw "ffprobe could not read $Path." }
  return [double]::Parse((($rawValue | Select-Object -First 1).ToString().Trim()), $culture)
}

function New-TitleCard {
  param(
    [string]$Name,
    [double]$Duration,
    [string]$Title,
    [string]$Subtitle,
    [string]$Accent = "0x35C7FF"
  )

  $target = Join-Path $tempRoot "$Name.mp4"
  $titleText = Escape-DrawText $Title
  $subtitleText = Escape-DrawText $Subtitle
  $filter = @(
    "[1:v]scale=620:-1,format=rgba[logo]",
    "[0:v][logo]overlay=(W-w)/2:180:format=auto",
    "drawbox=x=48:y=48:w=1824:h=4:color=${Accent}:t=fill",
    "drawtext=fontfile='${fontFilterPath}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=690:text='$titleText'",
    "drawtext=fontfile='${fontFilterPath}':fontcolor=0x8AA7C8:fontsize=32:x=(w-text_w)/2:y=790:text='$subtitleText'[v]"
  ) -join ","

  $arguments = @(
    "-y", "-hide_banner", "-loglevel", "warning",
    "-f", "lavfi", "-i", "color=c=0x071226:s=1920x1080:r=30",
    "-loop", "1", "-i", $logo,
    "-t", (Format-Seconds $Duration),
    "-filter_complex", $filter,
    "-map", "[v]",
    "-an", "-c:v", $videoEncoder
  )
  $arguments += $videoOptions
  $arguments += @("-pix_fmt", "yuv420p", $target)
  Invoke-Ffmpeg $arguments

  return [PSCustomObject]@{ Name = $Name; Path = $target; Duration = Get-Duration $target; Type = "title-card" }
}

function New-AppScene {
  param(
    [string]$Name,
    [string]$Source,
    [double]$InputStart,
    [double]$Duration,
    [double]$HoldEnd = 0,
    [switch]$MaskInviteHost
  )

  $target = Join-Path $tempRoot "$Name.mp4"
  $filters = @($commonVideoFilter)

  if ($MaskInviteHost) {
    # Keep the real Game code, Student Join Link label, QR, and classroom warning,
    # but replace the local development hostname in the captured link.
    $headerText = Escape-DrawText "Use your classroom join address"
    $linkText = Escape-DrawText "Use the code or QR to join"
    $filters += "drawbox=x=935:y=486:w=470:h=42:color=0x071226@0.98:t=fill"
    $filters += "drawtext=fontfile='${fontFilterPath}':fontcolor=0x8AA7C8:fontsize=20:x=950:y=495:text='$headerText'"
    $filters += "drawbox=x=510:y=615:w=710:h=52:color=0x071226@0.98:t=fill"
    $filters += "drawtext=fontfile='${fontFilterPath}':fontcolor=0x8AA7C8:fontsize=24:x=528:y=629:text='$linkText'"
  }

  if ($HoldEnd -gt 0) {
    $filters += "tpad=stop_mode=clone:stop_duration=$(Format-Seconds $HoldEnd)"
  }

  $requestedOutputDuration = $Duration + $HoldEnd

  $arguments = @("-y", "-hide_banner", "-loglevel", "warning")
  if ($InputStart -gt 0) { $arguments += @("-ss", (Format-Seconds $InputStart)) }
  $arguments += @(
    "-i", $Source,
    "-t", (Format-Seconds $requestedOutputDuration),
    "-vf", ($filters -join ","),
    "-an", "-c:v", $videoEncoder
  )
  $arguments += $videoOptions
  $arguments += @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $target)
  Invoke-Ffmpeg $arguments

  return [PSCustomObject]@{ Name = $Name; Path = $target; Duration = Get-Duration $target; Type = "app" }
}

# V3 deliberately starts from the V1 visual language: full-page UI, generous
# margins, calm title cards, and short transitions. It does not use the V2 edit.
$intro = New-TitleCard -Name "00-intro" -Duration 2.0 -Title "GET YOUR CLASS PLAYING IN MINUTES" -Subtitle "QuizStrike Classroom - Teacher Quick Start" -Accent "0x35C7FF"

$accountCard = New-TitleCard -Name "01-account-card" -Duration 0.8 -Title "1 / 4  CREATE YOUR ACCOUNT" -Subtitle "Create your teacher profile." -Accent "0x35C7FF"
$accountAction = New-AppScene -Name "02-account-action" -Source $raw.account -InputStart 1.8 -Duration 2.6 -HoldEnd 0.8
$accountResult = New-AppScene -Name "03-account-result" -Source $raw.account -InputStart 3.9 -Duration 0.8 -HoldEnd 1.0

$quizCard = New-TitleCard -Name "04-quiz-card" -Duration 0.8 -Title "2 / 4  MAKE A QUIZ" -Subtitle "Build a question set from a study list." -Accent "0x48E0B2"
$quizDashboard = New-AppScene -Name "05-quiz-dashboard" -Source $raw.quiz -InputStart 1.0 -Duration 0.8 -HoldEnd 0.7
$quizEditor = New-AppScene -Name "06-quiz-editor" -Source $raw.quiz -InputStart 1.8 -Duration 1.5 -HoldEnd 1.4
$quizResult = New-AppScene -Name "07-quiz-result" -Source $raw.quiz -InputStart 2.8 -Duration 0.8 -HoldEnd 1.4

$gameCard = New-TitleCard -Name "08-game-card" -Duration 0.8 -Title "3 / 4  CREATE A GAME" -Subtitle "Choose the game and arena." -Accent "0xFFC44D"
$gameSetup = New-AppScene -Name "09-game-setup" -Source $raw.game -InputStart 1.2 -Duration 2.5 -HoldEnd 0.7
$gameLobby = New-AppScene -Name "10-game-lobby" -Source $raw.game -InputStart 3.5 -Duration 0.9 -HoldEnd 1.0 -MaskInviteHost

$inviteCard = New-TitleCard -Name "11-invite-card" -Duration 0.7 -Title "INVITE YOUR STUDENTS" -Subtitle "Game code - Student Join Link - QR code" -Accent "0x35C7FF"
$inviteCode = New-AppScene -Name "12-invite-code" -Source $raw.invite -InputStart 4.4 -Duration 1.2 -HoldEnd 1.0 -MaskInviteHost
$studentSide = New-AppScene -Name "13-student-side" -Source $raw.student -InputStart 5.4 -Duration 1.0 -HoldEnd 0.2
$inviteTwo = New-AppScene -Name "14-invite-two" -Source $raw.invite -InputStart 6.5 -Duration 1.0 -HoldEnd 0.8 -MaskInviteHost
$inviteThree = New-AppScene -Name "15-invite-three" -Source $raw.invite -InputStart 9.5 -Duration 1.0 -HoldEnd 1.4 -MaskInviteHost

$startCard = New-TitleCard -Name "16-start-card" -Duration 0.7 -Title "4 / 4  START THE GAME" -Subtitle "Press Start game when everyone is ready." -Accent "0xFFC44D"
$startAction = New-AppScene -Name "17-start-action" -Source $raw.start -InputStart 2.0 -Duration 0.8 -HoldEnd 0.3 -MaskInviteHost
$preparation = New-AppScene -Name "18-preparation" -Source $raw.start -InputStart 2.8 -Duration 0.7 -HoldEnd 0.2
$live = New-AppScene -Name "19-live-game" -Source $raw.start -InputStart 8.4 -Duration 1.3 -HoldEnd 0.4

$outro = New-TitleCard -Name "20-outro" -Duration 2.3 -Title "YOU ARE READY TO PLAY" -Subtitle "QuizStrike Classroom - Create. Quiz. Compete." -Accent "0x48E0B2"

$scenes = @(
  $intro, $accountCard, $accountAction, $accountResult,
  $quizCard, $quizDashboard, $quizEditor, $quizResult,
  $gameCard, $gameSetup, $gameLobby,
  $inviteCard, $inviteCode, $studentSide, $inviteTwo, $inviteThree,
  $startCard, $startAction, $preparation, $live, $outro
)

$concatList = Join-Path $tempRoot "scenes.txt"
$concatLines = foreach ($scene in $scenes) {
  "file '$($scene.Path.Replace('\', '/'))'"
}
Set-Content -LiteralPath $concatList -Value $concatLines -Encoding ascii

$videoOnly = Join-Path $tempRoot "video-only.mp4"
Invoke-Ffmpeg @(
  "-y", "-hide_banner", "-loglevel", "warning",
  "-f", "concat", "-safe", "0", "-i", $concatList,
  "-an", "-c:v", "copy", $videoOnly
)

$totalDuration = Get-Duration $videoOnly
$sceneStarts = @{}
$cursor = 0.0
foreach ($scene in $scenes) {
  $sceneStarts[$scene.Name] = $cursor
  $cursor += $scene.Duration
}

# V3 has no BGM. The only audio is sparse, quiet UI feedback over silence.
$audioInputs = @("-f", "lavfi", "-t", (Format-Seconds $totalDuration), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000")
$audioFilters = @("[1:a]atrim=0:$((Format-Seconds $totalDuration)),asetpts=N/SR/TB[silence]")
$mixLabels = @("[silence]")
$cueDefinitions = @(
  @{ Path = $click; At = $sceneStarts["01-account-card"]; Volume = 0.32 },
  @{ Path = $click2; At = $sceneStarts["04-quiz-card"]; Volume = 0.30 },
  @{ Path = $click; At = $sceneStarts["08-game-card"]; Volume = 0.30 },
  @{ Path = $click2; At = $sceneStarts["11-invite-card"]; Volume = 0.28 },
  @{ Path = $click2; At = $sceneStarts["13-student-side"]; Volume = 0.24 },
  @{ Path = $bell; At = $sceneStarts["16-start-card"]; Volume = 0.22 },
  @{ Path = $click; At = $sceneStarts["20-outro"]; Volume = 0.24 }
)
$nextInput = 2
foreach ($cue in $cueDefinitions) {
  $delay = [Math]::Max(0, [Math]::Round([double]$cue.At * 1000))
  $label = "cue$nextInput"
  $audioInputs += @("-i", $cue.Path)
  $audioFilters += "[$($nextInput):a]adelay=${delay}:all=1,volume=$($cue.Volume),aresample=48000[$label]"
  $mixLabels += "[$label]"
  $nextInput++
}
$audioFilters += (($mixLabels -join "") + "amix=inputs=$($mixLabels.Count):duration=first:dropout_transition=0,aresample=48000,loudnorm=I=-20:TP=-2:LRA=11[aout]")
$audioFilter = $audioFilters -join ";"

$finalArguments = @("-y", "-hide_banner", "-loglevel", "warning", "-i", $videoOnly)
$finalArguments += $audioInputs
$finalArguments += @(
  "-filter_complex", $audioFilter,
  "-map", "0:v:0", "-map", "[aout]",
  "-t", (Format-Seconds $totalDuration),
  "-c:v", $videoEncoder
)
$finalArguments += $videoOptions
$finalArguments += @(
  "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
  "-movflags", "+faststart",
  $OutputPath
)
Invoke-Ffmpeg $finalArguments
Copy-Item -LiteralPath $OutputPath -Destination $outputCopy -Force

$probeJson = (& $ffprobe -v error -show_entries format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,pix_fmt,channels,sample_rate -of json $OutputPath | Out-String)
if ($LASTEXITCODE -ne 0) { throw "ffprobe validation failed for $OutputPath." }
$probe = $probeJson | ConvertFrom-Json
$videoStream = @($probe.streams | Where-Object { $_.codec_type -eq "video" })[0]
$audioStream = @($probe.streams | Where-Object { $_.codec_type -eq "audio" })[0]
$validatedDuration = [double]$probe.format.duration
$fpsParts = ($videoStream.r_frame_rate -split "/")
$fpsValue = [double]$fpsParts[0] / [double]$fpsParts[1]

if ($validatedDuration -lt 36 -or $validatedDuration -gt 42) { throw "V3 duration is outside the requested 36-42 second range: $validatedDuration" }
if ([int]$videoStream.width -ne 1920 -or [int]$videoStream.height -ne 1080) { throw "V3 is not 1920x1080." }
if ([Math]::Abs($fpsValue - 30) -gt 0.01) { throw "V3 is not 30 fps: $($videoStream.r_frame_rate)" }
if ($videoStream.codec_name -ne "h264") { throw "V3 video codec is not H.264: $($videoStream.codec_name)" }
if ($audioStream.codec_name -ne "aac" -or [int]$audioStream.channels -ne 2 -or [int]$audioStream.sample_rate -ne 48000) { throw "V3 audio is not stereo AAC at 48 kHz." }

$validationFrames = @()
foreach ($scene in $scenes) {
  $frameAt = [Math]::Min(0.9, [Math]::Max(0.1, $scene.Duration / 2))
  $framePath = Join-Path $validationRoot "$($scene.Name).png"
  Invoke-Ffmpeg @(
    "-y", "-hide_banner", "-loglevel", "warning",
    "-ss", (Format-Seconds $frameAt), "-i", $scene.Path,
    "-frames:v", "1", "-vf", "scale=960:540", "-q:v", "2", $framePath
  )
  $validationFrames += [PSCustomObject]@{ Name = $scene.Name; AtSeconds = [Math]::Round($sceneStarts[$scene.Name] + $frameAt, 3); Path = $framePath }
}

$validation = [ordered]@{
  output = $OutputPath
  outputCopy = $outputCopy
  durationSeconds = [Math]::Round($validatedDuration, 3)
  music = "none"
  visualReference = "V1 clean full-page composition; V2 not used as the base edit"
  video = [ordered]@{
    codec = $videoStream.codec_name
    width = [int]$videoStream.width
    height = [int]$videoStream.height
    frameRate = $videoStream.r_frame_rate
    pixelFormat = $videoStream.pix_fmt
  }
  audio = [ordered]@{
    codec = $audioStream.codec_name
    channels = [int]$audioStream.channels
    sampleRate = [int]$audioStream.sample_rate
    sources = @("silence bed", "click1.ogg", "click2.ogg", "impactBell_heavy_000.ogg")
  }
  scenes = $scenes | ForEach-Object {
    [ordered]@{ name = $_.Name; startSeconds = [Math]::Round($sceneStarts[$_.Name], 3); durationSeconds = [Math]::Round($_.Duration, 3); type = $_.Type }
  }
  validationFrames = $validationFrames
}
$validation | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot "v3-validation.json") -Encoding utf8

$decodeCheck = & $ffmpeg -v error -i $OutputPath -f null NUL 2>&1
if ($LASTEXITCODE -ne 0) { throw "V3 decode check failed: $decodeCheck" }

Write-Host "Created $OutputPath"
Write-Host "Copied $outputCopy"
Write-Host "Duration: $([Math]::Round($validatedDuration, 3)) seconds"
Write-Host "Video: $($videoStream.codec_name) $($videoStream.width)x$($videoStream.height) $($videoStream.r_frame_rate)"
Write-Host "Audio: $($audioStream.codec_name) $($audioStream.channels)ch $($audioStream.sample_rate)Hz; no BGM"
