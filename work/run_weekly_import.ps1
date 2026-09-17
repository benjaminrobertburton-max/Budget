param(
  [string]$OutputDir = ""
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
  node $builder --phase=import --quiet
} finally {
  Pop-Location
}
