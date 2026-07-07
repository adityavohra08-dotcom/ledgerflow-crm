# LedgerFlow CRM — one-click Railway deploy
# Prerequisite: run `railway login` first (or complete browser activation)

$ErrorActionPreference = "Stop"
$railway = "$env:APPDATA\npm\railway.cmd"

if (-not (Test-Path $railway)) {
    Write-Host "Installing Railway CLI..."
    npm.cmd install -g @railway/cli
}

Write-Host "Checking Railway login..."
& $railway whoami
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run: railway login"
    exit 1
}

Set-Location $PSScriptRoot

if (-not (Test-Path ".railway")) {
    Write-Host "Creating Railway project..."
    & $railway init --name ledgerflow-crm
}

$jwt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
Write-Host "Setting environment variables..."
& $railway variables set "JWT_SECRET=$jwt"
& $railway variables set "CORS_ORIGIN=*"
& $railway variables set "DEFAULT_TENANT_ID=udyog-suvidha"
Write-Host "Optional: set Google OAuth for client sign-in:"
Write-Host "  railway variables set GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com"
Write-Host "Firewall is enabled by default. Optional overrides:"
Write-Host "  railway variables set CORS_ORIGIN=https://your-app.up.railway.app"
Write-Host "  railway variables set FIREWALL_BLOCK_IPS=1.2.3.4,5.6.7.8"

Write-Host "Deploying to Railway..."
& $railway up --detach

Write-Host "Generating public domain..."
& $railway domain 2>$null

Write-Host ""
Write-Host "Done! Open your Railway URL (run 'railway open' or check dashboard)."
Write-Host "Demo logins: adityavohra08@gmail.com / 2004Aditya@  |  client123 for clients"
Write-Host ""
Write-Host "IMPORTANT: Add a Volume in Railway dashboard:"
Write-Host "  Service -> Settings -> Volumes -> Mount path: /data"
Write-Host "  Then set variable: DB_PATH=/data/store.json"
Write-Host "  (Without volume, data resets on redeploy)"