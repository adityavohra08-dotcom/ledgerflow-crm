# Deploy LedgerFlow Books (API + Web + Postgres) on Railway
$ErrorActionPreference = "Stop"
$railway = "$env:APPDATA\npm\railway.cmd"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Generating domains..."
& $railway domain --service ledgerflow-api --json 2>$null
& $railway domain --service ledgerflow-web --json 2>$null

Write-Host "Redeploying API + Web..."
& $railway service link ledgerflow-api
& $railway up --detach

& $railway service link ledgerflow-web
& $railway up --detach

& $railway service link ledgerflow-crm
Write-Host "Done. Check Railway dashboard for URLs."