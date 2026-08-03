[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("AuditSource", "Backup", "AssertTargetEmpty", "Restore", "Verify")]
  [string]$Action,

  [string]$BackupPath,

  [switch]$ConfirmTargetRestore
)

$ErrorActionPreference = "Stop"
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = Resolve-Path (Join-Path $scriptDirectory "..\..")
$auditScript = Join-Path $scriptDirectory "audit-and-compare.mjs"
$backupDirectory = Join-Path $repositoryRoot "database-backups"
$migrationEnvironmentFile = Join-Path $repositoryRoot ".env.migration.local"

function Import-MigrationEnvironment {
  if (-not (Test-Path -LiteralPath $migrationEnvironmentFile -PathType Leaf)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $migrationEnvironmentFile) {
    if ($line -notmatch "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$") {
      continue
    }
    $name = $matches[1]
    $value = $matches[2]
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
      [Environment]::SetEnvironmentVariable($name, $value)
    }
  }
}

Import-MigrationEnvironment

function Assert-PostgresUrl {
  param([string]$Name, [string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "$Name is not set."
  }
  if ($Value -notmatch "^postgres(ql)?://") {
    throw "$Name must be a PostgreSQL connection URL."
  }
}

function Assert-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found on PATH. Install PostgreSQL client tools matching the source major version."
  }
}

function Invoke-WithDatabaseUrl {
  param(
    [string]$Url,
    [scriptblock]$Command
  )

  $uri = [System.Uri]$Url
  $userInfo = $uri.UserInfo -split ":", 2
  if ($userInfo.Count -ne 2) {
    throw "The PostgreSQL URL must contain both a username and password."
  }
  $databaseName = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($databaseName)) {
    throw "The PostgreSQL URL must contain a database name."
  }

  $sslMode = "require"
  foreach ($pair in $uri.Query.TrimStart("?").Split("&", [System.StringSplitOptions]::RemoveEmptyEntries)) {
    $parts = $pair -split "=", 2
    if ([System.Uri]::UnescapeDataString($parts[0]) -eq "sslmode" -and $parts.Count -eq 2) {
      $sslMode = [System.Uri]::UnescapeDataString($parts[1])
    }
  }

  $variableNames = @(
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGSSLMODE",
    "PGCONNECT_TIMEOUT"
  )
  $previousValues = @{}
  foreach ($name in $variableNames) {
    $previousValues[$name] = [Environment]::GetEnvironmentVariable($name)
  }

  try {
    # Split the URI into libpq environment variables. This keeps the password
    # out of the process arguments and removes Prisma-only query parameters.
    $env:PGHOST = $uri.Host
    $env:PGPORT = [string]$(if ($uri.Port -gt 0) { $uri.Port } else { 5432 })
    $env:PGDATABASE = $databaseName
    $env:PGUSER = [System.Uri]::UnescapeDataString($userInfo[0])
    $env:PGPASSWORD = [System.Uri]::UnescapeDataString($userInfo[1])
    $env:PGSSLMODE = $sslMode
    $env:PGCONNECT_TIMEOUT = "15"
    & $Command
    if ($LASTEXITCODE -ne 0) {
      throw "PostgreSQL command failed with exit code $LASTEXITCODE."
    }
  } finally {
    foreach ($name in $variableNames) {
      [Environment]::SetEnvironmentVariable($name, $previousValues[$name])
    }
  }
}

function Assert-InsideBackupDirectory {
  param([string]$Path)

  $resolvedAllowedDirectory = [System.IO.Path]::GetFullPath($backupDirectory)
  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  $allowedDirectoryWithSeparator = $resolvedAllowedDirectory.TrimEnd('\') + '\'
  if ($resolvedPath -ne $resolvedAllowedDirectory -and
      -not $resolvedPath.StartsWith($allowedDirectoryWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path must be inside $resolvedAllowedDirectory."
  }
  return $resolvedPath
}

function Invoke-NodeAudit {
  param([string[]]$Arguments)

  & node $auditScript @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Database audit/verification stopped with exit code $LASTEXITCODE."
  }
}

switch ($Action) {
  "AuditSource" {
    Assert-PostgresUrl "SOURCE_DATABASE_URL" $env:SOURCE_DATABASE_URL
    $previousUrl = $env:DATABASE_URL
    try {
      $env:DATABASE_URL = $env:SOURCE_DATABASE_URL
      Invoke-NodeAudit -Arguments @()
    } finally {
      $env:DATABASE_URL = $previousUrl
    }
  }

  "Backup" {
    Assert-PostgresUrl "SOURCE_DATABASE_URL" $env:SOURCE_DATABASE_URL
    Assert-Command "pg_dump"
    Assert-Command "pg_restore"

    if ([string]::IsNullOrWhiteSpace($BackupPath)) {
      $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
      $BackupPath = Join-Path $backupDirectory "quizstrike-render-$timestamp.dump"
    }

    $resolvedBackupPath = Assert-InsideBackupDirectory $BackupPath
    $resolvedBackupDirectory = Split-Path -Parent $resolvedBackupPath
    if (Test-Path -LiteralPath $BackupPath) {
      throw "Backup already exists at $BackupPath. Refusing to overwrite it."
    }

    New-Item -ItemType Directory -Force -Path $resolvedBackupDirectory | Out-Null
    Invoke-WithDatabaseUrl $env:SOURCE_DATABASE_URL {
      & pg_dump `
        --format=custom `
        --no-owner `
        --no-privileges `
        --no-subscriptions `
        --schema=public `
        --file=$resolvedBackupPath
    }
    & pg_restore --list $resolvedBackupPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "pg_restore could not read the completed backup."
    }
    Write-Output "Backup created and validated: $resolvedBackupPath"
  }

  "AssertTargetEmpty" {
    Assert-PostgresUrl "TARGET_DATABASE_URL" $env:TARGET_DATABASE_URL
    $previousUrl = $env:DATABASE_URL
    try {
      $env:DATABASE_URL = $env:TARGET_DATABASE_URL
      Invoke-NodeAudit -Arguments @("--assert-empty")
    } finally {
      $env:DATABASE_URL = $previousUrl
    }
  }

  "Restore" {
    Assert-PostgresUrl "TARGET_DATABASE_URL" $env:TARGET_DATABASE_URL
    Assert-Command "pg_restore"
    if (-not $ConfirmTargetRestore) {
      throw "Restore changes the target database. Re-run with -ConfirmTargetRestore after checking the project and backup path."
    }
    if ([string]::IsNullOrWhiteSpace($BackupPath)) {
      throw "BackupPath is required for Restore."
    }

    $resolvedBackupPath = Assert-InsideBackupDirectory $BackupPath
    if (-not (Test-Path -LiteralPath $resolvedBackupPath -PathType Leaf)) {
      throw "Backup not found: $resolvedBackupPath"
    }

    $restoreListName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedBackupPath) + ".restore.list"
    $restoreListPath = Join-Path (Split-Path -Parent $resolvedBackupPath) $restoreListName
    $restoreListEntries = @(& pg_restore --list $resolvedBackupPath | Where-Object {
        $_ -notmatch "\sSCHEMA - public\s" -and $_ -notmatch "\sCOMMENT - SCHEMA public\s"
      })
    if ($LASTEXITCODE -ne 0) {
      throw "pg_restore could not create a filtered restore list."
    }
    Set-Content -LiteralPath $restoreListPath -Value $restoreListEntries -Encoding ascii

    $previousUrl = $env:DATABASE_URL
    try {
      $env:DATABASE_URL = $env:TARGET_DATABASE_URL
      Invoke-NodeAudit -Arguments @("--assert-empty")
    } finally {
      $env:DATABASE_URL = $previousUrl
    }

    Invoke-WithDatabaseUrl $env:TARGET_DATABASE_URL {
      & pg_restore `
        --exit-on-error `
        --single-transaction `
        --no-owner `
        --no-privileges `
        --dbname=$env:PGDATABASE `
        --use-list=$restoreListPath `
        --verbose `
        $resolvedBackupPath
    }
    Write-Output "Restore completed in one transaction: $resolvedBackupPath"
  }

  "Verify" {
    Assert-PostgresUrl "SOURCE_DATABASE_URL" $env:SOURCE_DATABASE_URL
    Assert-PostgresUrl "TARGET_DATABASE_URL" $env:TARGET_DATABASE_URL
    Invoke-NodeAudit -Arguments @("--checksums")
  }
}
