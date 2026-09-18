param(
  [ValidateSet("Test", "Demo", "StorageDemo", "BrowserTest", "BrowserDemo", "BrowserInteractive", "RecoveryCheck", "RecoverTest", "PilotRehearsal", "WellsPilot")]
  [string]$Mode = "Test",
  [switch]$ConfirmCleanup
)

$ErrorActionPreference = "Stop"
if ($Mode -eq "RecoverTest" -and -not $ConfirmCleanup) {
  throw "Use RecoveryCheck first. RecoverTest requires -ConfirmCleanup and removes only a proven stopped disposable test."
}
if ($ConfirmCleanup -and $Mode -ne "RecoverTest") { throw "ConfirmCleanup applies only to RecoverTest." }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22 or newer must be installed before running the offline collector demonstration."
}
Push-Location $PSScriptRoot
try {
  if ($Mode -eq "Demo") {
    & node src/cli.mjs demo
  } elseif ($Mode -eq "StorageDemo") {
    & node src/cli.mjs storage-demo
  } elseif ($Mode -eq "BrowserTest") {
    & node --test --test-concurrency=1 'test-browser/*.test.mjs'
  } elseif ($Mode -eq "BrowserDemo") {
    & node src/cli.mjs browser-demo
  } elseif ($Mode -eq "BrowserInteractive") {
    & node src/cli.mjs browser-interactive
  } elseif ($Mode -eq "RecoveryCheck") {
    & node src/cli.mjs recover-test
  } elseif ($Mode -eq "RecoverTest") {
    & node src/cli.mjs recover-test --confirm-cleanup
  } elseif ($Mode -eq "PilotRehearsal") {
    & node src/cli.mjs pilot-rehearsal
  } elseif ($Mode -eq "WellsPilot") {
    & node src/cli.mjs wells-pilot
  } else {
    & node --test 'test/*.test.mjs'
  }
  $collectorExitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $collectorExitCode
