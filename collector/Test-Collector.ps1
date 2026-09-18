param(
  [ValidateSet("Test", "Demo", "StorageDemo")]
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
  } else {
    & node --test 'test/*.test.mjs'
  }
  $collectorExitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $collectorExitCode
