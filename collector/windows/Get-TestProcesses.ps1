# Read-only process metadata, never command lines, user names, URLs or browser data.
# Used only to prove a disposable test is stopped. This helper never kills a process.
$ErrorActionPreference = "Stop"
try {
  $collectorRequest = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if ($collectorRequest.version -ne 1 -or $collectorRequest.ownerPid -lt 1 -or
      $collectorRequest.ownerPid -gt [int]::MaxValue) { throw "Invalid request" }
  $collectorOwnerPid = [int]$collectorRequest.ownerPid
  $collectorBoot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString("o")
  $collectorRows = @(Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR ProcessId = $collectorOwnerPid")
  $collectorProcesses = @()
  foreach ($collectorRow in $collectorRows) {
    if ($null -eq $collectorRow.CreationDate) { throw "Process date unavailable" }
    $collectorProcesses += @{
      pid = [int]$collectorRow.ProcessId
      parentPid = [int]$collectorRow.ParentProcessId
      kind = $(if ($collectorRow.Name -ieq "chrome.exe") { "chrome" } else { "owner" })
      createdAt = $collectorRow.CreationDate.ToUniversalTime().ToString("o")
    }
  }
  $collectorResponse = @{
    version = 1; bootId = $collectorBoot
    observedAt = [DateTime]::UtcNow.ToString("o")
    processes = @($collectorProcesses)
  } | ConvertTo-Json -Compress -Depth 4
  [Console]::Out.Write($collectorResponse)
} catch {
  [Console]::Error.Write("Test process state could not be verified.")
  exit 1
}
