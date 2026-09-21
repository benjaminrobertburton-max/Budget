param(
  [string]$OutputDir = "",
  [string]$CollectorConfig = ""
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$builder = Join-Path $repo "work\build_comprehensive_budget.mjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found on PATH. Install Node.js or run this from the configured Codex workspace runtime."
}

if ($OutputDir -ne "") {
  $env:BUDGET_OUTPUT_DIR = $OutputDir
}

Push-Location $repo
try {
  if ($CollectorConfig -ne "") {
    if ($OutputDir -ne "") { throw "Collector intake uses the private output location in its configuration, not OutputDir." }
    node $builder "--collector-intake=$CollectorConfig" --quiet
  } else {
    node $builder --phase=import --quiet
  }
  if ($LASTEXITCODE -ne 0) { throw "Workbook operation failed; see the safe status above." }
} finally {
  Pop-Location
}
