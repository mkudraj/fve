# Start Chrome with remote debugging on a dedicated profile (Windows).
# Port 9222 is bound to 127.0.0.1 only — never exposed to the network.
#
# Usage (from PowerShell):
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-chrome.ps1
#   .\scripts\start-chrome.ps1

$ErrorActionPreference = "Stop"

$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
  $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $chrome)) {
  $other = Get-ChildItem "${env:ProgramFiles}\Google\Chrome\Application" -ErrorAction SilentlyContinue
  $cand = Get-ChildItem -Path "${env:LocalAppData}\Google\Chrome\Application\chrome.exe" -ErrorAction SilentlyContinue
  if ($cand) { $chrome = $cand.FullName }
  if (-not (Test-Path $chrome)) {
    Write-Error "Chrome not found. Install Google Chrome first ($chrome)."
    exit 1
  }
}

$profileDir = Join-Path $env:TEMP "faceit-investigator-profile"
$debugPort = 9222

Write-Host "Starting Chrome with remote debugging on port $debugPort" -ForegroundColor Cyan
Write-Host "Profile: $profileDir" -ForegroundColor Cyan
Write-Host "CDP endpoint: http://127.0.0.1:$debugPort" -ForegroundColor Cyan
Write-Host ""

& $chrome `
  --remote-debugging-port=$debugPort `
  --remote-debugging-address=127.0.0.1 `
  --user-data-dir="$profileDir" `
  --no-first-run `
  --no-default-browser-check `
  "https://www.faceit.com/"

Write-Host ""
Write-Host "Chrome launched. Next steps:" -ForegroundColor Green
Write-Host "  1. Log in to FACEIT in this profile."
Write-Host "  2. Open the CS2 matchmaking page."
Write-Host "  3. In Warp run:  npm run capture"
Write-Host ""
