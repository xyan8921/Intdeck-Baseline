# §1.1 baseline 独立仓全历史密钥扫描（gitleaks）
# 用法：在仓库根目录执行 .\scripts\scan-git-secrets.ps1
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$ReportDir = Join-Path $Root 'docs\security'
$ReportPath = Join-Path $ReportDir 'gitleaks-full-history.json'

if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
  Write-Error 'gitleaks not on PATH. Install: winget install Gitleaks.Gitleaks'
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
Push-Location $Root
try {
  gitleaks detect --source . --log-opts='--all' --redact `
    --report-format json --report-path $ReportPath
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "OK: report -> $ReportPath"
} finally {
  Pop-Location
}
