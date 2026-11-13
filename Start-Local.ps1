$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.env')) {
    $jwtSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
    (Get-Content '.env.example' -Raw).Replace('replace-this-with-a-random-secret-at-least-32-characters', $jwtSecret) | Set-Content '.env'
}
$settings = @{}
Get-Content '.env' | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$') { $settings[$Matches[1]] = $Matches[2] }
}
$dbPort = if ($settings.DB_PORT) { [int]$settings.DB_PORT } else { 3306 }
$client = [Net.Sockets.TcpClient]::new()
try { $client.Connect('127.0.0.1', $dbPort); $dbRunning = $true } catch { $dbRunning = $false } finally { $client.Dispose() }
if (-not $dbRunning) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker compose up -d mysql --wait
        if ($LASTEXITCODE -ne 0) { throw 'MySQL Docker startup failed.' }
    } else {
        throw 'Start MySQL using your installation or install Docker Desktop. See README.md.'
    }
}
if (-not (Test-Path -LiteralPath 'node_modules')) {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
Write-Host 'Open http://127.0.0.1:5173 after Vite starts. Press Ctrl+C to stop the app.'
npm run dev
