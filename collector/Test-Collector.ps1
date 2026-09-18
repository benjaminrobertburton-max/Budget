param(
  [ValidateSet("Test", "Demo", "StorageDemo", "BrowserTest", "BrowserDemo", "BrowserInteractive")]
  [string]$Mode = "Test"
)

$ErrorActionPreference = "Stop"
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
    & node --test 'test-browser/*.test.mjs'
  } elseif ($Mode -eq "BrowserDemo") {
    & node src/cli.mjs browser-demo
  } elseif ($Mode -eq "BrowserInteractive") {
    & node src/cli.mjs browser-interactive
  } else {
    & node --test 'test/*.test.mjs'
  }
  $collectorExitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $collectorExitCode
