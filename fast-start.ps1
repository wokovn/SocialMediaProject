param(
    [switch]$SkipInstall,
    [switch]$SkipRedis,
    [switch]$SameWindow
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSCommandPath
$backendDir = Join-Path $repoRoot 'social-backend'
$frontendDir = Join-Path $repoRoot 'social-frontend'

function Test-Command {
    param([Parameter(Mandatory = $true)][string]$Name)

    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# Reads a key=value pair from a .env file. Returns the default if the key is absent.
function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$File,
        [Parameter(Mandatory = $true)][string]$Key,
        [string]$Default = ''
    )

    if (-not (Test-Path $File)) { return $Default }
    $line = Get-Content $File | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -Last 1
    if (-not $line) { return $Default }
    # Strip inline comments and surrounding quotes
    $value = ($line -split '=', 2)[1] -replace '#.*$', '' -replace '^"|"$|^''|''$', '' | ForEach-Object { $_.Trim() }
    return $value
}

function Ensure-PathExists {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not (Test-Path $Path)) {
        throw "$Label path not found: $Path"
    }
}

function Ensure-NodeModules {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectDir,
        [Parameter(Mandatory = $true)][string]$ProjectName
    )

    $nodeModules = Join-Path $ProjectDir 'node_modules'
    if (Test-Path $nodeModules) {
        Write-Host "[ok] $ProjectName dependencies found" -ForegroundColor Green
        return
    }

    Write-Host "[info] Installing $ProjectName dependencies..." -ForegroundColor Yellow
    Push-Location $ProjectDir
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

function Start-Redis {
    param([Parameter(Mandatory = $true)][string]$ComposeDir)

    if (-not (Test-Command 'docker')) {
        Write-Warning 'Docker is not installed or not on PATH. Skipping Redis startup.'
        return
    }

    Push-Location $ComposeDir
    try {
        $hasDockerComposePlugin = $false
        try {
            docker compose version *> $null
            $hasDockerComposePlugin = $LASTEXITCODE -eq 0
        }
        catch {
            $hasDockerComposePlugin = $false
        }

        if ($hasDockerComposePlugin) {
            Write-Host '[info] Starting Redis with docker compose...' -ForegroundColor Cyan
            docker compose -f docker-compose.yaml up -d
            return
        }

        if (Test-Command 'docker-compose') {
            Write-Host '[info] Starting Redis with docker-compose...' -ForegroundColor Cyan
            docker-compose -f docker-compose.yaml up -d
            return
        }

        Write-Warning 'Neither docker compose plugin nor docker-compose command was found. Skipping Redis startup.'
    }
    finally {
        Pop-Location
    }
}

function Start-InNewTerminal {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string]$WorkingDir,
        [Parameter(Mandatory = $true)][string]$Command
    )

    $script = "`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location -Path '$WorkingDir'; $Command"
    Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $script) | Out-Null
}

function Start-InBackgroundJob {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$WorkingDir,
        [Parameter(Mandatory = $true)][string]$Command
    )

    $existingJob = Get-Job -Name $Name -ErrorAction SilentlyContinue
    if ($null -ne $existingJob) {
        Stop-Job -Job $existingJob -ErrorAction SilentlyContinue
        Remove-Job -Job $existingJob -Force -ErrorAction SilentlyContinue
    }

    Start-Job -Name $Name -ScriptBlock {
        param($Dir, $Cmd)
        Set-Location -Path $Dir
        Invoke-Expression $Cmd
    } -ArgumentList $WorkingDir, $Command | Out-Null
}

if (-not (Test-Command 'npm')) {
    throw 'npm is required but was not found on PATH.'
}

Ensure-PathExists -Path $backendDir -Label 'Backend'
Ensure-PathExists -Path $frontendDir -Label 'Frontend'

if (-not $SkipInstall) {
    Ensure-NodeModules -ProjectDir $backendDir -ProjectName 'backend'
    Ensure-NodeModules -ProjectDir $frontendDir -ProjectName 'frontend'
}

# Determine whether Redis should be started:
#   1. -SkipRedis flag always wins.
#   2. Otherwise read REDIS_ENABLED from social-backend/.env (defaults to true).
$backendEnvFile = Join-Path $backendDir '.env'
$redisEnabledValue = Get-EnvValue -File $backendEnvFile -Key 'REDIS_ENABLED' -Default 'true'
$shouldStartRedis = (-not $SkipRedis) -and ($redisEnabledValue -ne 'false')

if ($shouldStartRedis) {
    Start-Redis -ComposeDir $backendDir
} elseif ($SkipRedis) {
    Write-Host '[info] Skipping Redis startup (-SkipRedis flag set).' -ForegroundColor Yellow
} else {
    Write-Host '[info] Skipping Redis startup (REDIS_ENABLED=false in .env).' -ForegroundColor Yellow
}

if ($SameWindow) {
    Write-Host '[info] Starting services as background jobs in this terminal...' -ForegroundColor Cyan
    Start-InBackgroundJob -Name 'social-backend-api' -WorkingDir $backendDir -Command 'npm run dev'
    Start-InBackgroundJob -Name 'social-backend-worker' -WorkingDir $backendDir -Command 'npm run worker:dev'
    Start-InBackgroundJob -Name 'social-frontend-dev' -WorkingDir $frontendDir -Command 'npm run dev'

    Write-Host '[done] Services started in background jobs.' -ForegroundColor Green
    Write-Host 'API: http://localhost:3000 | Frontend: http://localhost:5173'
    Write-Host 'Use Get-Job to list jobs, Receive-Job -Name <job> -Keep to stream logs, and Stop-Job -Name <job> to stop.'
    return
}

Write-Host '[info] Opening new terminals for all services...' -ForegroundColor Cyan
Start-InNewTerminal -Title 'social-backend-api' -WorkingDir $backendDir -Command 'npm run dev'
Start-InNewTerminal -Title 'social-backend-worker' -WorkingDir $backendDir -Command 'npm run worker:dev'
Start-InNewTerminal -Title 'social-frontend-dev' -WorkingDir $frontendDir -Command 'npm run dev'

Write-Host '[done] Startup sequence complete.' -ForegroundColor Green
Write-Host 'API: http://localhost:3000 | Frontend: http://localhost:5173'