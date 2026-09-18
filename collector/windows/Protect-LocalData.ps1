param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Protect", "Unprotect")]
  [string]$Operation
)

# Data travels through pipes; this helper writes no plaintext files or diagnostic content.
# Uses the logged-on Windows user's DPAPI protection, not machine-wide protection.
$ErrorActionPreference = "Stop"
try {
  Add-Type -AssemblyName System.Security
  $collectorRequest = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if ($collectorRequest.version -ne 1 -or $null -eq $collectorRequest.items -or $collectorRequest.items.Count -gt 10000) {
    throw "Invalid request"
  }
  $collectorEntropy = [Text.Encoding]::UTF8.GetBytes("BudgetCollector.LocalStore.v1")
  $collectorResults = @()
  foreach ($collectorItem in $collectorRequest.items) {
    $collectorBytes = [Convert]::FromBase64String($collectorItem)
    if ($Operation -eq "Protect") {
      $collectorResult = [Security.Cryptography.ProtectedData]::Protect(
        $collectorBytes, $collectorEntropy, [Security.Cryptography.DataProtectionScope]::CurrentUser
      )
    } else {
      $collectorResult = [Security.Cryptography.ProtectedData]::Unprotect(
        $collectorBytes, $collectorEntropy, [Security.Cryptography.DataProtectionScope]::CurrentUser
      )
    }
    $collectorResults += [Convert]::ToBase64String($collectorResult)
    [Array]::Clear($collectorBytes, 0, $collectorBytes.Length)
    [Array]::Clear($collectorResult, 0, $collectorResult.Length)
  }
  $collectorResponse = @{ version = 1; items = @($collectorResults) } | ConvertTo-Json -Compress
  [Console]::Out.Write($collectorResponse)
} catch {
  # Never echo exception text: it can include source content or a local path.
  [Console]::Error.Write("Windows local data protection failed.")
  exit 1
}
