[CmdletBinding()]
param(
  [string]$OutputPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$outputRoot = Join-Path $PSScriptRoot "output"
$validationRoot = Join-Path $outputRoot "validation-v2"
$tempRoot = Join-Path $outputRoot ("build-temp-v2-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $workspaceRoot "quizstrike-teacher-onboarding-v2.mp4"
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$outputCopy = Join-Path $outputRoot "quizstrike-teacher-onboarding-v2.mp4"

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

$fontFile = if (Test-Path -LiteralPath "C:\Windows\Fonts\arialbd.ttf") {
  "C:\Windows\Fonts\arialbd.ttf"
} elseif (Test-Path -LiteralPath "C:\Windows\Fonts\segoeuib.ttf") {
  "C:\Windows\Fonts\segoeuib.ttf"
} else {
  "C:\Windows\Fonts\arial.ttf"
}
$fontFilterPath = (($fontFile -replace "\\", "/") -replace ":", "\:")
$culture = [Globalization.CultureInfo]::InvariantCulture
$videoEncoder = "libx264"
$videoOptions = @("-preset", "medium", "-crf", "18")
$commonVideoFilter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071226,setsar=1,fps=30"

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
foreach ($asset in @($click, $click2, $bell) + $raw.Values) {
  if (-not (Test-Path -LiteralPath $asset)) { throw "Required asset is missing: $asset" }
}

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

function New-Clip {
  param(
    [string]$Name,
    [string]$Source,
    [double]$InputStart,
    [double]$Duration,
    [string]$Step,
    [string]$Callout,
    [string]$Accent,
    [string]$Crop = "",
    [double]$HoldEnd = 1.0,
    [switch]$MaskInviteHost
  )

  $target = Join-Path $tempRoot "$Name.mp4"
  $stepText = Escape-DrawText $Step
  $calloutText = Escape-DrawText $Callout
  $filters = @()
  if ([string]::IsNullOrWhiteSpace($Crop)) {
    $filters += $commonVideoFilter
  } else {
    $filters += $Crop
    $filters += "scale=1920:1080:flags=lanczos"
    $filters += "setsar=1"
    $filters += "fps=30"
  }
  if ($HoldEnd -gt 0) {
    $filters += "tpad=stop_mode=clone:stop_duration=$(Format-Seconds $HoldEnd)"
  }

  # A compact two-line step marker keeps QuizStrike visible throughout the edit.
  $filters += "drawbox=x=260:y=92:w=630:h=88:color=0x061327@0.84:t=fill"
  $filters += "drawbox=x=260:y=92:w=6:h=88:color=${Accent}:t=fill"
  $filters += "drawtext=fontfile='${fontFilterPath}':fontcolor=${Accent}:fontsize=24:x=292:y=113:text='$stepText'"
  $filters += "drawtext=fontfile='${fontFilterPath}':fontcolor=white:fontsize=28:x=292:y=148:text='$calloutText'"

  if ($MaskInviteHost) {
    # Coordinates are for the 1700x900 invite crop after it is scaled to 1920x1080.
    $headerText = Escape-DrawText "Use your classroom join address"
    $linkText = Escape-DrawText "Use the code or QR to join"
    $filters += "drawbox=x=935:y=486:w=470:h=42:color=0x071226@0.98:t=fill"
    $filters += "drawtext=fontfile='${fontFilterPath}':fontcolor=0x8AA7C8:fontsize=20:x=950:y=495:text='$headerText'"
    $filters += "drawbox=x=450:y=650:w=800:h=60:color=0x071226@0.98:t=fill"
    $filters += "drawtext=fontfile='${fontFilterPath}':fontcolor=0x8AA7C8:fontsize=24:x=480:y=668:text='$linkText'"
  }

  $arguments = @("-y", "-hide_banner", "-loglevel", "warning")
  if ($InputStart -gt 0) { $arguments += @("-ss", (Format-Seconds $InputStart)) }
  $arguments += @(
    "-i", $Source,
    "-t", (Format-Seconds $Duration),
    "-vf", ($filters -join ","),
    "-an", "-c:v", $videoEncoder
  )
  $arguments += $videoOptions
  $arguments += @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $target)
  Invoke-Ffmpeg $arguments

  return [PSCustomObject]@{
    Name = $Name
    Path = $target
    Duration = Get-Duration $target
    Step = $Step
    Callout = $Callout
  }
}

$intro = New-Clip -Name "00-intro" -Source $raw.quiz -InputStart 0.3 -Duration 2.0 -Step "QUIZSTRIKE TEACHER QUICK START" -Callout "Get your class playing in minutes" -Accent "0x35C7FF" -Crop "crop=1720:940:100:70" -HoldEnd 0.2
$accountForm = New-Clip -Name "01-account-form" -Source $raw.account -InputStart 2.1 -Duration 2.5 -Step "1 / 4  ACCOUNT" -Callout "Create your account" -Accent "0x35C7FF" -Crop "crop=1280:900:640:90" -HoldEnd 0.2
$accountResult = New-Clip -Name "02-account-result" -Source $raw.account -InputStart 4.0 -Duration 2.0 -Step "1 / 4  ACCOUNT" -Callout "Dashboard ready" -Accent "0x35C7FF" -Crop "crop=1600:900:260:90" -HoldEnd 0.8

$quizLibrary = New-Clip -Name "03-quiz-library" -Source $raw.quiz -InputStart 1.5 -Duration 1.5 -Step "2 / 4  QUIZ" -Callout "Create a question set" -Accent "0x48E0B2" -Crop "crop=1200:750:680:75" -HoldEnd 0.2
$quizEditor = New-Clip -Name "04-quiz-editor" -Source $raw.quiz -InputStart 1.9 -Duration 2.8 -Step "2 / 4  QUIZ" -Callout "Add your questions" -Accent "0x48E0B2" -Crop "crop=1450:920:380:80" -HoldEnd 1.0

$gameSetup = New-Clip -Name "05-game-setup" -Source $raw.game -InputStart 1.2 -Duration 3.0 -Step "3 / 4  GAME" -Callout "Choose your game and arena" -Accent "0xFFC44D" -Crop "crop=1500:900:320:70" -HoldEnd 0.3
$gameResult = New-Clip -Name "06-game-result" -Source $raw.game -InputStart 3.45 -Duration 1.7 -Step "3 / 4  GAME" -Callout "Create the room" -Accent "0xFFC44D" -Crop "crop=1700:900:100:80" -HoldEnd 0.7

$student = New-Clip -Name "07-student-join" -Source $raw.student -InputStart 5.4 -Duration 3.0 -Step "3 / 4  STUDENTS JOIN" -Callout "Join with the code" -Accent "0x48E0B2" -Crop "crop=1700:950:100:50" -HoldEnd 0.2
$inviteCode = New-Clip -Name "08-invite-code" -Source $raw.invite -InputStart 5.3 -Duration 2.0 -Step "3 / 4  STUDENTS JOIN" -Callout "Share the code, link or QR" -Accent "0x35C7FF" -Crop "crop=1700:900:100:80" -HoldEnd 0.2 -MaskInviteHost
$inviteTwo = New-Clip -Name "09-invite-two" -Source $raw.invite -InputStart 7.1 -Duration 2.0 -Step "3 / 4  STUDENTS JOIN" -Callout "Students appear here" -Accent "0x35C7FF" -Crop "crop=1500:320:350:760" -HoldEnd 0.2
$inviteThree = New-Clip -Name "10-invite-three" -Source $raw.invite -InputStart 9.1 -Duration 2.0 -Step "3 / 4  STUDENTS JOIN" -Callout "2 joined -> 3 joined" -Accent "0x35C7FF" -Crop "crop=1500:320:350:760" -HoldEnd 0.2

$startAction = New-Clip -Name "11-start-action" -Source $raw.start -InputStart 2.0 -Duration 0.85 -Step "4 / 4  START" -Callout "Start when everyone is ready" -Accent "0xFFC44D" -Crop "crop=1500:300:350:780" -HoldEnd 0.15
$preparation = New-Clip -Name "12-preparation" -Source $raw.start -InputStart 2.8 -Duration 0.7 -Step "4 / 4  START" -Callout "Starting the live game" -Accent "0xFFC44D" -Crop "crop=1500:900:300:80" -HoldEnd 0
$live = New-Clip -Name "13-live-game" -Source $raw.start -InputStart 8.4 -Duration 2.8 -Step "4 / 4  START" -Callout "The game is running" -Accent "0xFFC44D" -Crop "crop=1550:900:300:80" -HoldEnd 0.8
$ending = New-Clip -Name "14-ending" -Source $raw.start -InputStart 8.9 -Duration 2.2 -Step "4 / 4  START" -Callout "You are ready to play" -Accent "0x48E0B2" -Crop "crop=1550:900:300:80" -HoldEnd 0.8

$scenes = @($intro, $accountForm, $accountResult, $quizLibrary, $quizEditor, $gameSetup, $gameResult, $student, $inviteCode, $inviteTwo, $inviteThree, $startAction, $preparation, $live, $ending)
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

# V2 intentionally has no BGM. The only audio inputs are sparse UI sounds mixed over silence.
$audioInputs = @("-f", "lavfi", "-t", (Format-Seconds $totalDuration), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000")
$audioFilters = @("[1:a]atrim=0:$((Format-Seconds $totalDuration)),asetpts=N/SR/TB[silence]")
$mixLabels = @("[silence]")
$cueDefinitions = @(
  @{ Path = $click; At = $sceneStarts["01-account-form"] + 1.65; Volume = 0.46 },
  @{ Path = $click2; At = $sceneStarts["03-quiz-library"] + 0.95; Volume = 0.42 },
  @{ Path = $click2; At = $sceneStarts["04-quiz-editor"] + 1.55; Volume = 0.38 },
  @{ Path = $click; At = $sceneStarts["05-game-setup"] + 1.15; Volume = 0.40 },
  @{ Path = $click2; At = $sceneStarts["06-game-result"] + 0.55; Volume = 0.40 },
  @{ Path = $click; At = $sceneStarts["09-invite-two"]; Volume = 0.34 },
  @{ Path = $click2; At = $sceneStarts["10-invite-three"]; Volume = 0.34 },
  @{ Path = $bell; At = $sceneStarts["11-start-action"] + 0.75; Volume = 0.24 }
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
$audioFilters += (($mixLabels -join "") + "amix=inputs=$($mixLabels.Count):duration=first:dropout_transition=0,aresample=48000,loudnorm=I=-19:TP=-2:LRA=11[aout]")
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

if ($validatedDuration -lt 30 -or $validatedDuration -gt 35) { throw "V2 duration is outside the requested 30-35 second range: $validatedDuration" }
if ([int]$videoStream.width -ne 1920 -or [int]$videoStream.height -ne 1080) { throw "V2 is not 1920x1080." }
if ([Math]::Abs($fpsValue - 30) -gt 0.01) { throw "V2 is not 30 fps: $($videoStream.r_frame_rate)" }
if ($videoStream.codec_name -ne "h264") { throw "V2 video codec is not H.264: $($videoStream.codec_name)" }
if ($audioStream.codec_name -ne "aac" -or [int]$audioStream.channels -ne 2) { throw "V2 audio is not stereo AAC." }

$validationFrames = @()
foreach ($scene in $scenes) {
  $frameAt = [Math]::Min(1.0, [Math]::Max(0.1, $scene.Duration / 2))
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
    [ordered]@{ name = $_.Name; startSeconds = [Math]::Round($sceneStarts[$_.Name], 3); durationSeconds = [Math]::Round($_.Duration, 3); step = $_.Step; callout = $_.Callout }
  }
  validationFrames = $validationFrames
}
$validation | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot "v2-validation.json") -Encoding utf8

$decodeCheck = & $ffmpeg -v error -i $OutputPath -f null NUL 2>&1
if ($LASTEXITCODE -ne 0) { throw "V2 decode check failed: $decodeCheck" }

Write-Host "Created $OutputPath"
Write-Host "Copied $outputCopy"
Write-Host "Duration: $([Math]::Round($validatedDuration, 3)) seconds"
Write-Host "Video: $($videoStream.codec_name) $($videoStream.width)x$($videoStream.height) $($videoStream.r_frame_rate)"
Write-Host "Audio: $($audioStream.codec_name) $($audioStream.channels)ch $($audioStream.sample_rate)Hz; no BGM"
