[CmdletBinding()]
param(
  [string]$OutputPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$outputRoot = Join-Path $PSScriptRoot "output"
$validationRoot = Join-Path $outputRoot "validation"
$tempRoot = Join-Path $outputRoot ("build-temp-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $workspaceRoot "quizstrike-teacher-onboarding.mp4"
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$outputCopy = Join-Path $outputRoot "quizstrike-teacher-onboarding.mp4"

New-Item -ItemType Directory -Force -Path $outputRoot, $validationRoot, $tempRoot | Out-Null

function Resolve-Tool {
  param([string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }
  foreach ($name in @("ffmpeg", "ffprobe")) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
  }
  throw "Could not find the requested media tool."
}

$ffmpeg = Resolve-Tool @(
  "C:\Users\hungb\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffmpeg.exe",
  "C:\Users\hungb\AppData\Local\LINE\Data\plugin\ffmpeg\1.0.0.5\ffmpeg.exe",
  "C:\Users\hungb\AppData\Local\Programs\LNV\Stremio-4\ffmpeg.exe"
)
$ffprobe = Resolve-Tool @(
  "C:\Users\hungb\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffprobe.exe",
  "C:\Users\hungb\AppData\Local\LINE\Data\plugin\ffmpeg\1.0.0.5\ffprobe.exe",
  "C:\Users\hungb\AppData\Local\Programs\LNV\Stremio-4\ffprobe.exe"
)

$logo = Join-Path $workspaceRoot "apps\web\public\assets\quizstrike-classroom-logo.png"
$bgm = Join-Path $workspaceRoot "apps\web\public\assets\audio\game\tank-metal.mp3"
$click = Join-Path $workspaceRoot "apps\web\public\assets\audio\kenney\click1.ogg"
$click2 = Join-Path $workspaceRoot "apps\web\public\assets\audio\kenney\click2.ogg"
$bell = Join-Path $workspaceRoot "apps\web\public\assets\audio\kenney\impactBell_heavy_000.ogg"
$rawRoot = Join-Path $PSScriptRoot "raw"

foreach ($asset in @($logo, $bgm, $click, $click2, $bell)) {
  if (-not (Test-Path -LiteralPath $asset)) {
    throw "Required asset is missing: $asset"
  }
}

$culture = [Globalization.CultureInfo]::InvariantCulture

function Format-Seconds {
  param([double]$Value)
  return $Value.ToString("0.000", $culture)
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

  $raw = & $ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $Path 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "ffprobe could not read $Path."
  }
  return [double]::Parse((($raw | Select-Object -First 1).ToString().Trim()), $culture)
}

function Escape-DrawText {
  param([string]$Value)

  return $Value.Replace("\", "\\").Replace(":", "\:").Replace("'", "\'").Replace(",", "\,").Replace(";", "\;")
}

$fontFile = if (Test-Path -LiteralPath "C:\Windows\Fonts\arialbd.ttf") {
  "C:\Windows\Fonts\arialbd.ttf"
} elseif (Test-Path -LiteralPath "C:\Windows\Fonts\segoeuib.ttf") {
  "C:\Windows\Fonts\segoeuib.ttf"
} else {
  "C:\Windows\Fonts\arial.ttf"
}
$fontFilterPath = ($fontFile -replace "\\", "/") -replace ":", "\:"

$videoEncoder = "libx264"
$videoOptions = @("-preset", "medium", "-crf", "18")

$commonVideoFilter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x071226,setsar=1,fps=30"

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

  return [PSCustomObject]@{ Name = $Name; Path = $target; Duration = Get-Duration $target; Title = $Title }
}

function New-Scene {
  param(
    [string]$Name,
    [string]$Source,
    [double]$InputStart,
    [double]$Duration,
    [string]$Step,
    [string]$Title,
    [string]$CaptionLine1,
    [string]$CaptionLine2,
    [string]$Accent = "0x35C7FF"
  )

  $target = Join-Path $tempRoot "$Name.mp4"
  $stepText = Escape-DrawText $Step
  $titleText = Escape-DrawText $Title
  $captionOne = Escape-DrawText $CaptionLine1
  $captionTwo = Escape-DrawText $CaptionLine2

  $filters = @(
    $commonVideoFilter,
    "drawbox=x=28:y=838:w=452:h=170:color=0x061327@0.90:t=fill",
    "drawbox=x=28:y=838:w=8:h=170:color=${Accent}:t=fill",
    "drawtext=fontfile='${fontFilterPath}':fontcolor=${Accent}:fontsize=24:x=58:y=860:text='$stepText'",
    "drawtext=fontfile='${fontFilterPath}':fontcolor=white:fontsize=26:x=58:y=895:text='$captionOne'",
    "drawtext=fontfile='${fontFilterPath}':fontcolor=white:fontsize=26:x=58:y=932:text='$captionTwo'"
  )

  if ($Name -like "*invite") {
    $maskedText = Escape-DrawText "Use the code or QR to join"
    $headerMaskedText = Escape-DrawText "Use your classroom join address"
    $filters += "drawbox=x=935:y=486:w=470:h=42:color=0x071226@0.98:t=fill"
    $filters += "drawtext=fontfile='${fontFilterPath}':fontcolor=0x8AA7C8:fontsize=20:x=950:y=495:text='$headerMaskedText'"
    $filters += "drawbox=x=510:y=615:w=710:h=52:color=0x071226@0.98:t=fill"
    $filters += "drawtext=fontfile='${fontFilterPath}':fontcolor=0x8AA7C8:fontsize=24:x=528:y=629:text='$maskedText'"
  }

  $filter = $filters -join ","
  $arguments = @("-y", "-hide_banner", "-loglevel", "warning")
  if ($InputStart -gt 0) {
    $arguments += @("-ss", (Format-Seconds $InputStart))
  }
  $arguments += @(
    "-i", $Source,
    "-t", (Format-Seconds $Duration),
    "-vf", $filter,
    "-an", "-c:v", $videoEncoder
  )
  $arguments += $videoOptions
  $arguments += @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $target)
  Invoke-Ffmpeg $arguments

  return [PSCustomObject]@{
    Name = $Name
    Path = $target
    Duration = Get-Duration $target
    Title = $Title
  }
}

$raw = @{
  account = Join-Path $rawRoot "01-account.webm"
  quiz = Join-Path $rawRoot "02-make-quiz.webm"
  game = Join-Path $rawRoot "03-create-game.webm"
  invite = Join-Path $rawRoot "04-invite-students.webm"
  student = Join-Path $rawRoot "student-join.webm"
  start = Join-Path $rawRoot "05-start-game.webm"
}
foreach ($source in $raw.Values) {
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing raw capture: $source. Run the Playwright capture first."
  }
}

if ($false) {
$intro = New-TitleCard -Name "00-intro" -Duration 2.8 -Title "GET YOUR CLASS PLAYING IN MINUTES" -Subtitle "QuizStrike Classroom · Teacher Quick Start" -Accent "0x35C7FF"
$account = New-Scene -Name "01-account" -Source $raw.account -InputStart 0 -Duration (Get-Duration $raw.account) -Step "1 / 4  CREATE YOUR ACCOUNT" -Title "Create a teacher account" -CaptionLine1 "Create your teacher profile." -CaptionLine2 "You are ready to build a quiz." -Accent "0x35C7FF"
$quiz = New-Scene -Name "02-quiz" -Source $raw.quiz -InputStart 0 -Duration (Get-Duration $raw.quiz) -Step "2 / 4  MAKE A QUIZ" -Title "Create a question set" -CaptionLine1 "Build from a study list." -CaptionLine2 "Review the questions, then save." -Accent "0x48E0B2"
$game = New-Scene -Name "03-game" -Source $raw.game -InputStart 0 -Duration (Get-Duration $raw.game) -Step "3 / 4  CREATE A GAME" -Title "Set up a game" -CaptionLine1 "Choose the game and arena." -CaptionLine2 "Create the classroom room." -Accent "0xFFC44D"
$student = New-Scene -Name "04-student" -Source $raw.student -InputStart 5.5 -Duration 4.0 -Step "STUDENTS JOIN" -Title "Students choose a team" -CaptionLine1 "Students join with the code." -CaptionLine2 "Then choose Blue or Red." -Accent "0x48E0B2"
$invite = New-Scene -Name "05-invite" -Source $raw.invite -InputStart 0 -Duration (Get-Duration $raw.invite) -Step "INVITE STUDENTS" -Title "Share the room" -CaptionLine1 "Use the Game code, link," -CaptionLine2 "or QR code to invite students." -Accent "0x35C7FF"
$start = New-Scene -Name "06-start" -Source $raw.start -InputStart 0 -Duration (Get-Duration $raw.start) -Step "4 / 4  START THE GAME" -Title "Start the live game" -CaptionLine1 "When everyone is ready," -CaptionLine2 "press Start game." -Accent "0xFFC44D"
$outro = New-TitleCard -Name "07-outro" -Duration 2.8 -Title "YOU ARE READY TO PLAY" -Subtitle "QuizStrike Classroom · Create. Quiz. Compete." -Accent "0x48E0B2"

$scenes = @($intro, $account, $quiz, $game, $student, $invite, $start, $outro)
}

$intro = New-TitleCard -Name "00-intro" -Duration 4.0 -Title "GET YOUR CLASS PLAYING IN MINUTES" -Subtitle "QuizStrike Classroom - Teacher Quick Start" -Accent "0x35C7FF"
$accountCard = New-TitleCard -Name "01-account-card" -Duration 2.5 -Title "1 / 4  CREATE YOUR ACCOUNT" -Subtitle "Create a teacher account." -Accent "0x35C7FF"
$account = New-Scene -Name "02-account" -Source $raw.account -InputStart 2.1 -Duration 2.0 -Step "CREATE YOUR ACCOUNT" -Title "Create a teacher account" -CaptionLine1 "Create your teacher profile." -CaptionLine2 "Build your first quiz." -Accent "0x35C7FF"
$quizCard = New-TitleCard -Name "03-quiz-card" -Duration 2.5 -Title "2 / 4  MAKE A QUIZ" -Subtitle "Create a question set from a study list." -Accent "0x48E0B2"
$quiz = New-Scene -Name "04-quiz" -Source $raw.quiz -InputStart 1.6 -Duration 2.0 -Step "MAKE A QUIZ" -Title "Create a question set" -CaptionLine1 "Build from a study list." -CaptionLine2 "Review, then save." -Accent "0x48E0B2"
$gameCard = New-TitleCard -Name "05-game-card" -Duration 2.5 -Title "3 / 4  CREATE A GAME" -Subtitle "Choose the game and arena." -Accent "0xFFC44D"
$game = New-Scene -Name "06-game" -Source $raw.game -InputStart 1.7 -Duration 2.7 -Step "CREATE A GAME" -Title "Set up a game" -CaptionLine1 "Choose game and arena." -CaptionLine2 "Create the room." -Accent "0xFFC44D"
$student = New-Scene -Name "07-student" -Source $raw.student -InputStart 5.5 -Duration 4.0 -Step "STUDENTS JOIN" -Title "Students choose a team" -CaptionLine1 "Join with the code." -CaptionLine2 "Choose Blue or Red." -Accent "0x48E0B2"
$inviteCard = New-TitleCard -Name "08-invite-card" -Duration 2.5 -Title "INVITE STUDENTS" -Subtitle "Game code - Student Join Link - QR code" -Accent "0x35C7FF"
$invite = New-Scene -Name "09-invite" -Source $raw.invite -InputStart 5.5 -Duration 6.0 -Step "INVITE STUDENTS" -Title "Share the room" -CaptionLine1 "Game code, link, or QR." -CaptionLine2 "Invite your students." -Accent "0x35C7FF"
$startCard = New-TitleCard -Name "10-start-card" -Duration 2.5 -Title "4 / 4  START THE GAME" -Subtitle "Press Start game when everyone is ready." -Accent "0xFFC44D"
$start = New-Scene -Name "11-start" -Source $raw.start -InputStart 2.5 -Duration 8.0 -Step "START THE GAME" -Title "Start the live game" -CaptionLine1 "Everyone ready?" -CaptionLine2 "Press Start game." -Accent "0xFFC44D"
$outro = New-TitleCard -Name "12-outro" -Duration 4.0 -Title "YOU ARE READY TO PLAY" -Subtitle "QuizStrike Classroom - Create. Quiz. Compete." -Accent "0x48E0B2"

$scenes = @($intro, $accountCard, $account, $quizCard, $quiz, $gameCard, $game, $student, $inviteCard, $invite, $startCard, $start, $outro)
$concatList = Join-Path $tempRoot "scenes.txt"
$concatLines = foreach ($scene in $scenes) {
  $concatPath = $scene.Path.Replace("\", "/").Replace("'", "'\\''")
  "file '$concatPath'"
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

$audioInputs = @("-stream_loop", "-1", "-i", $bgm)
$audioFilters = @("[1:a]volume=0.14,atrim=0:$((Format-Seconds $totalDuration)),asetpts=N/SR/TB[bgm]")
$mixLabels = @("[bgm]")
$cueDefinitions = @(
  @{ Path = $click; At = $sceneStarts["01-account-card"]; Volume = 0.48 },
  @{ Path = $click2; At = $sceneStarts["03-quiz-card"]; Volume = 0.44 },
  @{ Path = $click; At = $sceneStarts["05-game-card"]; Volume = 0.48 },
  @{ Path = $click2; At = $sceneStarts["07-student"]; Volume = 0.40 },
  @{ Path = $click; At = $sceneStarts["08-invite-card"]; Volume = 0.48 },
  @{ Path = $bell; At = $sceneStarts["10-start-card"]; Volume = 0.28 },
  @{ Path = $click2; At = $sceneStarts["12-outro"]; Volume = 0.42 }
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
$audioFilters += (($mixLabels -join "") + "amix=inputs=$($mixLabels.Count):duration=first:dropout_transition=0,aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
$audioFilter = $audioFilters -join ";"

$finalArguments = @(
  "-y", "-hide_banner", "-loglevel", "warning",
  "-i", $videoOnly
)
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
  "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
  "-movflags", "+faststart",
  $OutputPath
)
Invoke-Ffmpeg $finalArguments
Copy-Item -LiteralPath $OutputPath -Destination $outputCopy -Force

$probeJson = (& $ffprobe -v error -show_entries format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,pix_fmt,channels,sample_rate -of json $OutputPath | Out-String)
if ($LASTEXITCODE -ne 0) {
  throw "ffprobe validation failed for $OutputPath."
}
$probe = $probeJson | ConvertFrom-Json
$videoStream = @($probe.streams | Where-Object { $_.codec_type -eq "video" })[0]
$audioStream = @($probe.streams | Where-Object { $_.codec_type -eq "audio" })[0]
$validatedDuration = [double]$probe.format.duration
$fps = ($videoStream.r_frame_rate -split "/")
$fpsValue = [double]$fps[0] / [double]$fps[1]

if ($validatedDuration -lt 45 -or $validatedDuration -gt 60) { throw "Final duration is outside the requested 45-60 second range: $validatedDuration" }
if ([int]$videoStream.width -ne 1920 -or [int]$videoStream.height -ne 1080) { throw "Final video is not 1920x1080." }
if ([Math]::Abs($fpsValue - 30) -gt 0.01) { throw "Final video is not 30 fps: $($videoStream.r_frame_rate)" }
if ($videoStream.codec_name -ne "h264") { throw "Final video codec is not H.264: $($videoStream.codec_name)" }
if ($audioStream.codec_name -ne "aac" -or [int]$audioStream.channels -ne 2) { throw "Final audio is not stereo AAC." }

$validationFrames = @()
foreach ($scene in $scenes) {
  $sceneAt = [Math]::Min(1.6, $scene.Duration / 2)
  $at = [Math]::Min($sceneStarts[$scene.Name] + $sceneAt, [Math]::Max(0.1, $validatedDuration - 0.2))
  $framePath = Join-Path $validationRoot "$($scene.Name).png"
  Invoke-Ffmpeg @(
    "-y", "-hide_banner", "-loglevel", "warning",
    "-ss", (Format-Seconds $sceneAt), "-i", $scene.Path,
    "-frames:v", "1", "-vf", "scale=960:540", "-q:v", "2", $framePath
  )
  $validationFrames += [PSCustomObject]@{ Name = $scene.Name; AtSeconds = [Math]::Round($at, 3); Path = $framePath }
}

$validation = [ordered]@{
  output = $OutputPath
  outputCopy = $outputCopy
  durationSeconds = [Math]::Round($validatedDuration, 3)
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
  }
  scenes = $scenes | ForEach-Object {
    [ordered]@{ name = $_.Name; startSeconds = [Math]::Round($sceneStarts[$_.Name], 3); durationSeconds = [Math]::Round($_.Duration, 3); title = $_.Title }
  }
  validationFrames = $validationFrames
}
$validation | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot "validation.json") -Encoding utf8

$decodeCheck = & $ffmpeg -v error -i $OutputPath -f null NUL 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "Final video decode check failed: $decodeCheck"
}

Write-Host "Created $OutputPath"
Write-Host "Copied $outputCopy"
Write-Host "Duration: $([Math]::Round($validatedDuration, 3)) seconds"
Write-Host "Video: $($videoStream.codec_name) $($videoStream.width)x$($videoStream.height) $($videoStream.r_frame_rate)"
Write-Host "Audio: $($audioStream.codec_name) $($audioStream.channels)ch $($audioStream.sample_rate)Hz"
