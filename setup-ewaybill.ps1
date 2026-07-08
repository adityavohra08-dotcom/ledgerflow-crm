# LedgerFlow — configure live NIC E-Way Bill API on Railway
# Prerequisite: railway login + linked project (.railway folder)

$ErrorActionPreference = "Stop"
$railway = "$env:APPDATA\npm\railway.cmd"

if (-not (Test-Path $railway)) {
    Write-Host "Install Railway CLI: npm install -g @railway/cli"
    exit 1
}

Write-Host ""
Write-Host "=== LedgerFlow E-Way Bill (Live NIC API) Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "You need TWO sets of credentials:" -ForegroundColor Yellow
Write-Host "  1) GSP keys (Client ID + Secret) — from MasterGST developer account"
Write-Host "  2) Portal API user (Username + Password) — from ewaybillgst.gov.in"
Write-Host ""
Write-Host "Step-by-step:" -ForegroundColor Green
Write-Host "  A. Sign up at https://app.mastergst.com/signup (ASP/Developer)"
Write-Host "  B. MasterGST → Credentials → E-Way Bill → Create Credentials"
Write-Host "     Copy Client ID and Client Secret"
Write-Host "  C. Login https://ewaybillgst.gov.in/ with taxpayer GSTIN"
Write-Host "  D. Left menu → Registration → For GSP → Add/New"
Write-Host "  E. Select GSP: Tera Software / MasterGST (name shown on portal)"
Write-Host "  F. Create API Username + Password (write them down first!)"
Write-Host "  G. Enter all values below"
Write-Host ""

$gstin = Read-Host "Taxpayer GSTIN (15 chars)"
$user = Read-Host "E-Way Bill portal API Username"
$pass = Read-Host "E-Way Bill portal API Password" -AsSecureString
$passPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
$clientId = Read-Host "GSP Client ID (from MasterGST)"
$clientSecret = Read-Host "GSP Client Secret (from MasterGST)"
$email = Read-Host "MasterGST account email (optional, press Enter to skip)"
$ip = Read-Host "Server public IP for GSP whitelist (optional)"

Set-Location $PSScriptRoot

& $railway variables set "EWAYBILL_GSTIN=$gstin"
& $railway variables set "EWAYBILL_USERNAME=$user"
& $railway variables set "EWAYBILL_PASSWORD=$passPlain"
& $railway variables set "EWAYBILL_CLIENT_ID=$clientId"
& $railway variables set "EWAYBILL_CLIENT_SECRET=$clientSecret"
& $railway variables set "EWAYBILL_PROVIDER=mastergst"
& $railway variables set "EWAYBILL_API_URL=https://api.mastergst.com/ewaybillapi/v1.03"
if ($email) { & $railway variables set "EWAYBILL_EMAIL=$email" }
if ($ip) { & $railway variables set "EWAYBILL_IP_ADDRESS=$ip" }

Write-Host ""
Write-Host "Variables set. Redeploying..." -ForegroundColor Cyan
& $railway up --detach

Write-Host ""
Write-Host "Done. After deploy (~2 min):" -ForegroundColor Green
Write-Host "  1. Admin login → open browser devtools → GET /api/ewaybill/test-auth (with Bearer token)"
Write-Host "  2. Or generate E-Way Bill from GST Invoice Maker — mode should show 'live' not 'demo'"
Write-Host ""
Write-Host "Health check: /api/health should show ewayBill.configured: true"
Write-Host ""