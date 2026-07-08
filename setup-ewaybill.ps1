# LedgerFlow — configure live E-Way Bill API on Railway

$ErrorActionPreference = "Stop"
$railway = "$env:APPDATA\npm\railway.cmd"

if (-not (Test-Path $railway)) {
    Write-Host "Install Railway CLI: npm install -g @railway/cli"
    exit 1
}

Write-Host ""
Write-Host "=== LedgerFlow E-Way Bill Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Choose provider:" -ForegroundColor Yellow
Write-Host "  1) sandbox   — FREE dev API (developer.sandbox.co.in) — RECOMMENDED ALTERNATE"
Write-Host "  2) mastergst — MasterGST GSP (app.mastergst.com)"
Write-Host "  3) portal    — Manual only (Export NIC JSON, no live API)"
Write-Host "  4) demo      — Local demo numbers only"
Write-Host ""
$choice = Read-Host "Enter 1-4 [default: 1]"

$provider = switch ($choice) {
    "2" { "mastergst" }
    "3" { "portal" }
    "4" { "demo" }
    default { "sandbox" }
}

Set-Location $PSScriptRoot
& $railway variables set "EWAYBILL_PROVIDER=$provider"

if ($provider -eq "demo" -or $provider -eq "portal") {
    Write-Host "Set to $provider mode. No API credentials needed." -ForegroundColor Green
    if ($provider -eq "portal") {
        Write-Host "Use 'Export NIC JSON' in GST Invoice Maker, then file on https://ewaybillgst.gov.in/"
    }
    & $railway up --detach
    exit 0
}

Write-Host ""
Write-Host "Portal API user (all providers):" -ForegroundColor Green
Write-Host "  ewaybillgst.gov.in -> Registration -> For GSP -> Add your GSP -> create API user/password"
Write-Host ""

$gstin = Read-Host "Taxpayer GSTIN"
$user = Read-Host "Portal API Username"
$pass = Read-Host "Portal API Password" -AsSecureString
$passPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))

& $railway variables set "EWAYBILL_GSTIN=$gstin"
& $railway variables set "EWAYBILL_USERNAME=$user"
& $railway variables set "EWAYBILL_PASSWORD=$passPlain"

if ($provider -eq "sandbox") {
    Write-Host ""
    Write-Host "Sandbox.co.in keys (free signup at developer.sandbox.co.in):" -ForegroundColor Green
    $apiKey = Read-Host "Sandbox API Key (test_... or key_test_...)"
    $apiSecret = Read-Host "Sandbox API Secret"
    $sandboxEnv = Read-Host "Environment test/live [test]"
    if (-not $sandboxEnv) { $sandboxEnv = "test" }
    & $railway variables set "EWAYBILL_API_KEY=$apiKey"
    & $railway variables set "EWAYBILL_API_SECRET=$apiSecret"
    & $railway variables set "EWAYBILL_SANDBOX_ENV=$sandboxEnv"
} else {
    Write-Host ""
    Write-Host "MasterGST keys (app.mastergst.com -> Credentials -> E-Way Bill):" -ForegroundColor Green
    $clientId = Read-Host "Client ID"
    $clientSecret = Read-Host "Client Secret"
    & $railway variables set "EWAYBILL_CLIENT_ID=$clientId"
    & $railway variables set "EWAYBILL_CLIENT_SECRET=$clientSecret"
    & $railway variables set "EWAYBILL_API_URL=https://api.mastergst.com/ewaybillapi/v1.03"
}

Write-Host ""
Write-Host "Redeploying..." -ForegroundColor Cyan
& $railway up --detach
Write-Host "Done. Test: GET /api/ewaybill/test-auth (admin login required)" -ForegroundColor Green