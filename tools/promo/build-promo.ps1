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
$outputRoot = Join-Path $promoRoot "output"
$tempRoot = Join-Path $promoRoot "build-temp"

if (-not $Source) { $Source = Join-Path $rawRoot "quizstrike-promo-session.webm" }
if (-not $OutputPath) { $OutputPath = Join-Path $workspaceRoot "quizstrike-promo-15s.mp4" }

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
  throw "Could not find $CommandName. Pass -${CommandName}Path or install a lightweight FFmpeg build."
}

$ffmpeg = Resolve-Tool $FfmpegPath @(
  "$env:USERPROFILE\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffmpeg.exe",
  "$env:USERPROFILE\AppData\Local\LINE\Data\plugin\ffmpeg\1.0.0.5\ffmpeg.exe",
  "$env:USERPROFILE\AppData\Local\Programs\LNV\Stremio-4\ffmpeg.exe"
) "ffmpeg"
$ffprobe = Resolve-Tool $FfprobePath @(
  "$env:USERPROFILE\AppData\Local\JDownloader 2.0\tools\Windows\ffmpeg\x64\ffprobe.exe"
) "ffprobe"

if (-not (Test-Path -LiteralPath $Source)) { throw "Raw capture not found at $Source" }
$sourceAsset = Join-Path $workspaceRoot "apps\web\public\assets\quizstrike-actual-gameplay.png"
$logoAsset = Join-Path $workspaceRoot "apps\web\public\assets\quizstrike-classroom-logo.png"
foreach ($asset in @($sourceAsset, $logoAsset)) {
  if (-not (Test-Path -LiteralPath $asset)) { throw "Required project asset not found at $asset" }
}

$fontFile = if (Test-Path "C:\Windows\Fonts\arialbd.ttf") { "C:\Windows\Fonts\arialbd.ttf" } else { "C:\Windows\Fonts\segoeuib.ttf" }
$fontForFilter = (($fontFile -replace "\\", "/") -replace ":", "\:")

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

function Invoke-FFmpeg([string[]]$Arguments) {
  & $ffmpeg @Arguments
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed with exit code $LASTEXITCODE" }
}

$probeArguments = @(
  "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", $Source
)
$sourceDuration = [double](& $ffprobe @probeArguments)
if ($sourceDuration -lt 55) { throw "Raw capture is only $sourceDuration seconds; expected the complete promo source take." }

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
  $clipPath = Join-Path $tempRoot "$Name.mp4"
  $arguments = @(
    "-y", "-hide_banner", "-loglevel", "warning",
    "-ss", $Start.ToString([Globalization.CultureInfo]::InvariantCulture),
    "-i", $Source,
    "-t", $Duration.ToString([Globalization.CultureInfo]::InvariantCulture),
    "-an", "-vf", $Filter, "-r", "30",
    "-c:v", $videoEncoder
  ) + $videoEncodeOptions + @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $clipPath)
  Invoke-FFmpeg $arguments
  return $clipPath
}

$baseFilter = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30"
$enterFilter = "$baseFilter,drawbox=x=68:y=68:w=8:h=78:color=0x35c7ff@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='ENTER':fontcolor=white:fontsize=64:borderw=3:bordercolor=0x071226@0.92:x=96:y=72"
$answerFilter = "$baseFilter,drawbox=x=68:y=68:w=8:h=78:color=0x7ef29a@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='ANSWER':fontcolor=white:fontsize=64:borderw=3:bordercolor=0x071226@0.92:x=96:y=72"
$earnFilter = "$baseFilter,drawbox=x=68:y=68:w=8:h=78:color=0xffd55c@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='EARN':fontcolor=white:fontsize=64:borderw=3:bordercolor=0x071226@0.92:x=96:y=72"
$playFilter = "$baseFilter,drawbox=x=68:y=68:w=8:h=78:color=0x35c7ff@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='PLAY':fontcolor=white:fontsize=64:borderw=3:bordercolor=0x071226@0.92:x=96:y=72"
$competeFilter = "$baseFilter,drawbox=x=68:y=68:w=8:h=78:color=0xff4a55@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='COMPETE':fontcolor=white:fontsize=64:borderw=3:bordercolor=0x071226@0.92:x=96:y=72"

$clips = @()
$clips += New-VideoClip "01-enter" 2.0 2.0 $enterFilter
$clips += New-VideoClip "02-answer" 6.25 2.7 $answerFilter
$clips += New-VideoClip "03-earn" 7.15 1.6 $earnFilter
$clips += New-VideoClip "04-play-impact" 45.0 1.6 $playFilter
$clips += New-VideoClip "05-play-arena" 46.6 1.6 $playFilter

$staticPlayPath = Join-Path $tempRoot "06-play-opponent.mp4"
$staticPlayFilter = "scale=2020:1080,crop=1920:1080:50:0,setsar=1,fps=30,drawbox=x=68:y=68:w=8:h=78:color=0x35c7ff@0.95:t=fill,drawtext=fontfile='$fontForFilter':text='PLAY':fontcolor=white:fontsize=64:borderw=3:bordercolor=0x071226@0.92:x=96:y=72"
$staticPlayArguments = @(
  "-y", "-hide_banner", "-loglevel", "warning", "-loop", "1", "-framerate", "30", "-i", $sourceAsset,
  "-t", "1.5", "-an", "-vf", $staticPlayFilter, "-r", "30", "-c:v", $videoEncoder
) + $videoEncodeOptions + @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $staticPlayPath)
Invoke-FFmpeg $staticPlayArguments
$clips += $staticPlayPath

$clips += New-VideoClip "07-compete" 49.6 1.5 $competeFilter

$heroPath = Join-Path $tempRoot "08-hero.mp4"
$heroFilter = "[0:v]$baseFilter[bg];[1:v]scale=760:-1[logo];[bg][logo]overlay=x=580:y=70:enable='between(t\,0.1\,2.4)'[branded];[branded]drawbox=x=0:y=850:w=1920:h=230:color=0x061327@0.72:t=fill,drawtext=fontfile='$fontForFilter':text='QUIZSTRIKE CLASSROOM':fontcolor=white:fontsize=62:borderw=3:bordercolor=0x071226@0.9:x=(w-text_w)/2:y=875,drawtext=fontfile='$fontForFilter':text='Learn. Compete. Play.':fontcolor=0xffd55c:fontsize=38:borderw=2:bordercolor=0x071226@0.9:x=(w-text_w)/2:y=954[v]"
$heroArguments = @(
  "-y", "-hide_banner", "-loglevel", "warning", "-ss", "51.1", "-i", $Source,
  "-loop", "1", "-i", $logoAsset, "-t", "2.5", "-an", "-filter_complex", $heroFilter,
  "-map", "[v]", "-r", "30", "-c:v", $videoEncoder
) + $videoEncodeOptions + @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $heroPath)
Invoke-FFmpeg $heroArguments
$clips += $heroPath

$concatList = Join-Path $tempRoot "concat.txt"
$concatContent = ($clips | ForEach-Object { "file '$(($_ -replace "'", "'\\''") -replace "\\", "/")'" }) -join [Environment]::NewLine
Set-Content -LiteralPath $concatList -Value $concatContent -Encoding ascii
$concatPath = Join-Path $tempRoot "video-only.mp4"
$concatArguments = @(
  "-y", "-hide_banner", "-loglevel", "warning", "-f", "concat", "-safe", "0", "-i", $concatList,
  "-t", "15", "-an", "-r", "30", "-c:v", $videoEncoder
) + $videoEncodeOptions + @("-pix_fmt", "yuv420p", "-movflags", "+faststart", $concatPath)
Invoke-FFmpeg $concatArguments

$audioRoot = Join-Path $workspaceRoot "apps\web\public\assets\audio"
$bgmFile = Join-Path $audioRoot "game\tank-metal.mp3"
$audioFiles = @(
  (Join-Path $audioRoot "kenney\click1.ogg"),
  (Join-Path $audioRoot "kenney\click2.ogg"),
  (Join-Path $audioRoot "kenney\handleCoins.ogg"),
  (Join-Path $audioRoot "game\default-gun-sound.mp3"),
  (Join-Path $audioRoot "game\default-gun-sound.mp3"),
  (Join-Path $audioRoot "kenney\impactSoft_heavy_000.ogg"),
  (Join-Path $audioRoot "kenney\handleCoins2.ogg"),
  (Join-Path $audioRoot "kenney\click3.ogg")
)
foreach ($audioFile in $audioFiles) {
  if (-not (Test-Path -LiteralPath $audioFile)) { throw "Project-owned audio asset not found at $audioFile" }
}
if (-not (Test-Path -LiteralPath $bgmFile)) { throw "QuizStrike BGM asset not found at $bgmFile" }

$audioDelays = @(100, 2100, 4800, 6500, 8100, 10900, 11200, 12600)
$finalAudio = "[0:v]tpad=stop_mode=clone:stop_duration=0.1[vout];[1:a]volume=0.04[a0]"
for ($index = 0; $index -lt $audioFiles.Count; $index += 1) {
  $inputIndex = $index + 2
  $finalAudio += ";[$inputIndex`:a]adelay=$($audioDelays[$index])|$($audioDelays[$index]),volume=0.62[a$($index + 1)]"
}
$bgmInputIndex = $audioFiles.Count + 2
$finalAudio += ";[$bgmInputIndex`:a]atrim=duration=15,volume=0.28,afade=t=in:st=0:d=0.25,afade=t=out:st=14.2:d=0.8[bmg]"
$mixLabels = @("a0") + (1..$audioFiles.Count | ForEach-Object { "a$_" }) + @("bmg")
$mixInputs = ($mixLabels | ForEach-Object { "[$_]" }) -join ""
$finalAudio += ";${mixInputs}amix=inputs=$($mixLabels.Count):duration=first:dropout_transition=0,alimiter=limit=0.92[aout]"

$finalDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $finalDirectory | Out-Null
$finalArguments = @(
  "-y", "-hide_banner", "-loglevel", "warning", "-i", $concatPath,
  "-f", "lavfi", "-t", "15", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"
)
foreach ($audioFile in $audioFiles) { $finalArguments += @("-i", $audioFile) }
$finalArguments += @("-stream_loop", "-1", "-i", $bgmFile)
$finalArguments += @(
  "-filter_complex", $finalAudio,
  "-map", "[vout]", "-map", "[aout]", "-t", "15",
  "-c:v", $videoEncoder
) + $videoEncodeOptions + @(
  "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-ac", "2",
  "-ar", "48000", "-movflags", "+faststart", $OutputPath
)
Invoke-FFmpeg $finalArguments

$outputMirror = Join-Path $outputRoot "quizstrike-promo-15s.mp4"
if ((Resolve-Path -LiteralPath $OutputPath).Path -ne (Join-Path $outputRoot "quizstrike-promo-15s.mp4")) {
  Copy-Item -LiteralPath $OutputPath -Destination $outputMirror -Force
}

$validation = & $ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,channels -of json $OutputPath
Write-Host $validation
Write-Host "Wrote $OutputPath"
Write-Host "Mirrored $outputMirror"
