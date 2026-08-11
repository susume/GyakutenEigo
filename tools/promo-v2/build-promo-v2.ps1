[CmdletBinding()]
param(
  [string]$Source = "",
  [string]$OutputPath = "",
  [string]$FfmpegPath = "",
  [string]$FfprobePath = ""
)

$ErrorActionPreference = "Stop"
$promoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $promoRoot)
$rawRoot = Join-Path $promoRoot "raw"
$clipRoot = Join-Path $rawRoot "clips"
$outputRoot = Join-Path $promoRoot "output"
$tempRoot = Join-Path $promoRoot "build-temp"

if (-not $Source) { $Source = Join-Path $rawRoot "quizstrike-promo-v2-session.webm" }
if (-not $OutputPath) { $OutputPath = Join-Path $workspaceRoot "quizstrike-promo-15s-v2.mp4" }

function Resolve-Tool([string]$ExplicitPath, [string[]]$Candidates, [string]$CommandName) {
  if ($ExplicitPath) {
    if (-not (Test-Path -LiteralPath $ExplicitPath)) { throw "${CommandName} was not found at $ExplicitPath" }
    return (Resolve-Path -LiteralPath $ExplicitPath).Path
  }
  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  foreach ($candidate in $Candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  throw "Could not find $CommandName. Pass -${CommandName}Path or install FFmpeg."
}

$ffmpeg = Resolve-Tool $FfmpegPath @(
  "$env:USERPROFILE\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffmpeg.exe",
  "$env:USERPROFILE\AppData\Local\LINE\Data\plugin\ffmpeg\1.0.0.5\ffmpeg.exe"
) "ffmpeg"
$ffprobe = Resolve-Tool $FfprobePath @(
  "$env:USERPROFILE\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffprobe.exe"
) "ffprobe"

if (-not (Test-Path -LiteralPath $Source)) { throw "Raw capture not found at $Source" }
$heroAsset = Join-Path $workspaceRoot "apps\web\public\assets\quizstrike-classroom-hero.png"
$logoAsset = Join-Path $workspaceRoot "apps\web\public\assets\quizstrike-classroom-logo.png"
$bgmFile = Join-Path $workspaceRoot "apps\web\public\assets\audio\game\tank-metal.mp3"
$audioRoot = Join-Path $workspaceRoot "apps\web\public\assets\audio"
foreach ($asset in @($heroAsset, $logoAsset, $bgmFile)) {
  if (-not (Test-Path -LiteralPath $asset)) { throw "Required project asset not found at $asset" }
}

$audioCues = @(
  @{ Path = (Join-Path $audioRoot "kenney\click1.ogg"); Delay = 1250; Volume = 0.85 },
  @{ Path = (Join-Path $audioRoot "kenney\switch1.ogg"); Delay = 2050; Volume = 0.72 },
  @{ Path = (Join-Path $audioRoot "kenney\click2.ogg"); Delay = 3050; Volume = 0.78 },
  @{ Path = (Join-Path $audioRoot "kenney\handleCoins.ogg"); Delay = 3800; Volume = 0.95 },
  @{ Path = (Join-Path $audioRoot "kenney\switch12.ogg"); Delay = 4350; Volume = 0.78 },
  @{ Path = (Join-Path $audioRoot "kenney\footstep_concrete_000.ogg"); Delay = 5550; Volume = 0.55 },
  @{ Path = (Join-Path $audioRoot "kenney\footstep_concrete_001.ogg"); Delay = 6400; Volume = 0.55 },
  @{ Path = (Join-Path $audioRoot "kenney\footstep_concrete_002.ogg"); Delay = 7250; Volume = 0.55 },
  @{ Path = (Join-Path $audioRoot "game\default-gun-sound.mp3"); Delay = 9700; Volume = 0.95 },
  @{ Path = (Join-Path $audioRoot "game\default-gun-sound.mp3"); Delay = 10100; Volume = 0.95 },
  @{ Path = (Join-Path $audioRoot "kenney\impactPunch_medium_000.ogg"); Delay = 10500; Volume = 1.00 },
  @{ Path = (Join-Path $audioRoot "kenney\impactBell_heavy_000.ogg"); Delay = 10850; Volume = 0.86 },
  @{ Path = (Join-Path $audioRoot "kenney\handleCoins2.ogg"); Delay = 11250; Volume = 0.82 },
  @{ Path = (Join-Path $audioRoot "kenney\click3.ogg"); Delay = 11800; Volume = 0.72 }
)
foreach ($cue in $audioCues) {
  if (-not (Test-Path -LiteralPath $cue.Path)) { throw "Project-owned audio asset not found at $($cue.Path)" }
}

$fontFile = if (Test-Path "C:\Windows\Fonts\arialbd.ttf") { "C:\Windows\Fonts\arialbd.ttf" } else { "C:\Windows\Fonts\segoeuib.ttf" }
$fontForFilter = (($fontFile -replace "\\", "/") -replace ":", "\:")
$invariant = [Globalization.CultureInfo]::InvariantCulture

New-Item -ItemType Directory -Force -Path $clipRoot, $outputRoot | Out-Null
if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

function Invoke-FFmpeg([string[]]$Arguments) {
  & $ffmpeg @Arguments
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed with exit code $LASTEXITCODE" }
}

$probeArguments = @("-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", $Source)
$sourceDuration = [double](& $ffprobe @probeArguments)
if ($sourceDuration -lt 55) { throw "Raw capture is only $sourceDuration seconds; expected the complete V2 source take." }

$encoderCheckArguments = @(
  "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=128x128:r=30", "-t", "0.2", "-c:v", "h264_nvenc", "-f", "null", "-"
)
& $ffmpeg @encoderCheckArguments 2>$null
$useNvenc = $LASTEXITCODE -eq 0
$videoEncoder = if ($useNvenc) { "h264_nvenc" } else { "libx264" }
$videoEncodeOptions = if ($useNvenc) {
  @("-preset", "slow", "-b:v", "8M", "-maxrate", "10M", "-bufsize", "16M")
} else {
  @("-preset", "medium", "-crf", "18")
}
Write-Host "Using $videoEncoder for the final H.264 export."

function New-VideoClip([string]$Name, [double]$Start, [double]$Duration, [string]$Filter) {
  $clipPath = Join-Path $clipRoot "$Name.mp4"
  $arguments = @(
    "-y", "-hide_banner", "-loglevel", "warning",
    "-ss", $Start.ToString($invariant), "-i", $Source,
    "-t", $Duration.ToString($invariant), "-an", "-vf", $Filter, "-r", "30",
    "-c:v", $videoEncoder
  ) + $videoEncodeOptions + @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $clipPath)
  Invoke-FFmpeg $arguments
  return $clipPath
}

function New-BrandClip([string]$Name, [double]$Duration) {
  $clipPath = Join-Path $clipRoot "$Name.mp4"
  $filter = "[0:v]drawbox=x=0:y=0:w=1920:h=1080:color=0x071226@1:t=fill[bg];[1:v]format=rgba,scale=790:-1[logo];[bg][logo]overlay=(W-w)/2:(H-h)/2,drawtext=fontfile='$fontForFilter':text='ANSWER. EARN. COMPETE.':fontcolor=0x9cecff:fontsize=30:x=(w-text_w)/2:y=790"
  $arguments = @(
    "-y", "-hide_banner", "-loglevel", "warning",
    "-f", "lavfi", "-i", "color=c=0x071226:s=1920x1080:r=30",
    "-loop", "1", "-i", $logoAsset, "-t", $Duration.ToString($invariant), "-an",
    "-filter_complex", ($filter + "[vout]"), "-map", "[vout]", "-r", "30", "-c:v", $videoEncoder
  ) + $videoEncodeOptions + @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $clipPath)
  Invoke-FFmpeg $arguments
  return $clipPath
}

function New-HeroClip([string]$Name, [double]$Duration) {
  $clipPath = Join-Path $clipRoot "$Name.mp4"
  $filter = "[0:v]scale=2020:1136,crop=1920:1080,setsar=1,drawbox=x=0:y=850:w=1920:h=230:color=0x061327@0.76:t=fill,drawtext=fontfile='$fontForFilter':text='QUIZSTRIKE CLASSROOM':fontcolor=white:fontsize=62:borderw=3:bordercolor=0x071226@0.9:x=(w-text_w)/2:y=875,drawtext=fontfile='$fontForFilter':text='LEARN. COMPETE. PLAY.':fontcolor=0xffd55c:fontsize=38:borderw=2:bordercolor=0x071226@0.9:x=(w-text_w)/2:y=954[vout]"
  $arguments = @(
    "-y", "-hide_banner", "-loglevel", "warning", "-loop", "1", "-i", $heroAsset,
    "-t", $Duration.ToString($invariant), "-an", "-filter_complex", $filter, "-map", "[vout]",
    "-r", "30", "-c:v", $videoEncoder
  ) + $videoEncodeOptions + @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $clipPath)
  Invoke-FFmpeg $arguments
  return $clipPath
}

$baseFilter = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30"
$actionFilter = "$baseFilter,eq=contrast=1.08:brightness=0.02:saturation=1.14"
$coldFilter = "$actionFilter,drawbox=x=72:y=72:w=8:h=74:color=0xff475c@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='REAL-TIME QUIZ BATTLE':fontcolor=white:fontsize=48:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"
$multiFilter = "$baseFilter,drawbox=x=72:y=72:w=8:h=74:color=0xff4b62@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='RED VS BLUE':fontcolor=white:fontsize=52:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"
$answerFilter = "$baseFilter,drawbox=x=72:y=72:w=8:h=74:color=0x7ef29a@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='ANSWER':fontcolor=white:fontsize=56:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"
$earnFilter = "$baseFilter,drawbox=x=72:y=72:w=8:h=74:color=0xffd55c@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='EARN +`$1,500':fontcolor=white:fontsize=52:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"
$gearFilter = "$baseFilter,drawbox=x=72:y=72:w=8:h=74:color=0x9cecff@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='GEAR UP':fontcolor=white:fontsize=52:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"
$roundFilter = "$actionFilter,drawtext=fontfile='$fontForFilter':text='ROUND LIVE':fontcolor=white:fontsize=42:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"
$opponentFilter = "$actionFilter,drawbox=x=72:y=72:w=8:h=74:color=0xff4b62@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='FIND YOUR TARGET':fontcolor=white:fontsize=48:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"
$hitFilter = "$actionFilter,drawbox=x=72:y=72:w=8:h=74:color=0xffd55c@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='FREEZE!':fontcolor=white:fontsize=58:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"
$scoreFilter = "$baseFilter,drawtext=fontfile='$fontForFilter':text='WHO TAKES THE ROUND?':fontcolor=white:fontsize=42:borderw=3:bordercolor=0x071226@0.92:x=100:y=78"

$clips = @()
$clips += New-VideoClip "01-cold-open" 50.45 0.8 $coldFilter
$clips += New-BrandClip "02-brand-sting" 0.5
$clips += New-VideoClip "03-multiplayer" 3.9 0.8 $multiFilter
$clips += New-VideoClip "04-answer" 8.1 0.95 $answerFilter
$clips += New-VideoClip "05-earn" 8.72 0.75 $earnFilter
$clips += New-VideoClip "06-equip" 9.35 0.75 $gearFilter
$clips += New-VideoClip "07-round-live" 19.8 0.6 $roundFilter
$clips += New-VideoClip "08-rail-run" 21.0 1.2 $actionFilter
$clips += New-VideoClip "09-rail-yard" 25.0 1.1 $actionFilter
$clips += New-VideoClip "10-rail-cross" 32.0 1.1 $actionFilter
$clips += New-VideoClip "11-approach" 45.5 1.0 $actionFilter
$clips += New-VideoClip "12-opponent-reveal" 49.0 1.3 $opponentFilter
$clips += New-VideoClip "13-hit-freeze" 50.2 1.1 $hitFilter
$clips += New-VideoClip "14-score-flash" 53.0 0.65 $scoreFilter
$clips += New-HeroClip "15-hero" 2.4

$concatList = Join-Path $tempRoot "concat.txt"
$concatContent = ($clips | ForEach-Object { "file '$((Resolve-Path -LiteralPath $_).Path -replace '\\', '/')'" }) -join [Environment]::NewLine
Set-Content -LiteralPath $concatList -Value $concatContent -Encoding ascii
$videoOnlyPath = Join-Path $tempRoot "video-only.mp4"
$concatArguments = @(
  "-y", "-hide_banner", "-loglevel", "warning", "-f", "concat", "-safe", "0", "-i", $concatList,
  "-t", "15", "-an", "-r", "30", "-c:v", $videoEncoder
) + $videoEncodeOptions + @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $videoOnlyPath)
Invoke-FFmpeg $concatArguments

$audioFilter = "[1:a]anull[a0]"
$mixLabels = @("a0")
for ($index = 0; $index -lt $audioCues.Count; $index += 1) {
  $inputIndex = $index + 2
  $label = "a$($index + 1)"
  $delay = $audioCues[$index].Delay
  $volume = $audioCues[$index].Volume
  $audioFilter += ";[$inputIndex`:a]adelay=$delay|$delay,volume=$volume[$label]"
  $mixLabels += $label
}
$bgmInputIndex = $audioCues.Count + 2
$audioFilter += ";[$bgmInputIndex`:a]atrim=duration=15,volume=0.58,afade=t=in:st=0:d=0.3,afade=t=out:st=14.1:d=0.9[bgm]"
$mixLabels += "bgm"
$mixInputs = ($mixLabels | ForEach-Object { "[$_]" }) -join ""
$audioFilter += ";${mixInputs}amix=inputs=$($mixLabels.Count):duration=first:dropout_transition=0,aresample=48000,loudnorm=I=-16:TP=-1.2:LRA=11:linear=false[aout]"

$finalDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $finalDirectory | Out-Null
$finalArguments = @(
  "-y", "-hide_banner", "-loglevel", "warning", "-i", $videoOnlyPath,
  "-f", "lavfi", "-t", "15", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"
)
foreach ($cue in $audioCues) { $finalArguments += @("-i", $cue.Path) }
$finalArguments += @("-stream_loop", "-1", "-i", $bgmFile)
$finalFilter = "[0:v]tpad=stop_mode=clone:stop_duration=0.1,setsar=1[vout];$audioFilter"
$finalArguments += @(
  "-filter_complex", $finalFilter, "-map", "[vout]", "-map", "[aout]", "-t", "15",
  "-c:v", $videoEncoder
) + $videoEncodeOptions + @(
  "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ac", "2",
  "-ar", "48000", "-movflags", "+faststart", $OutputPath
)
Invoke-FFmpeg $finalArguments

$outputMirror = Join-Path $outputRoot "quizstrike-promo-15s-v2.mp4"
if ((Resolve-Path -LiteralPath $OutputPath).Path -ne (Resolve-Path -LiteralPath $outputMirror -ErrorAction SilentlyContinue).Path) {
  Copy-Item -LiteralPath $OutputPath -Destination $outputMirror -Force
}

$probeOutput = & $ffprobe -v error -show_entries format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,pix_fmt,channels,sample_rate -of json $OutputPath
Set-Content -LiteralPath (Join-Path $outputRoot "quizstrike-promo-15s-v2-probe.json") -Value $probeOutput -Encoding utf8
$decodeOutput = & $ffmpeg -v error -i $OutputPath -f null NUL 2>&1
if ($LASTEXITCODE -ne 0) { throw "Final MP4 failed FFmpeg decode validation." }
$validationPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$loudnessOutput = & $ffmpeg -hide_banner -nostats -i $OutputPath -af "loudnorm=I=-16:TP=-1.2:LRA=11:print_format=json" -f null NUL 2>&1
$ErrorActionPreference = $validationPreference
Set-Content -LiteralPath (Join-Path $outputRoot "quizstrike-promo-15s-v2-loudnorm.txt") -Value ($loudnessOutput -join [Environment]::NewLine) -Encoding utf8

Write-Host "Wrote $OutputPath"
Write-Host "Mirrored $outputMirror"
Write-Host "Preserved raw clips in $clipRoot"
