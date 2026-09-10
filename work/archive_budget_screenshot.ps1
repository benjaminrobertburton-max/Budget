param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$Institution,
    [Parameter(Mandatory = $true)][string]$View,
    [Parameter(Mandatory = $true)][string]$Cycle,
    [string]$VisibleTransactionRange = "",
    [string]$LatestTransactionVisible = "",
    [string]$Notes = ""
)

$ErrorActionPreference = "Stop"
$archiveRoot = Join-Path $PSScriptRoot "..\sources\screenshots"
$extension = [System.IO.Path]::GetExtension($SourcePath)
if ([string]::IsNullOrWhiteSpace($extension)) { $extension = ".png" }
$receivedDate = Get-Date -Format 'yyyy-MM-dd'
$archiveFolder = Join-Path $archiveRoot "$(Get-Date -Format 'yyyy')\$(Get-Date -Format 'yyyy-MM')"
New-Item -ItemType Directory -Force -Path $archiveFolder | Out-Null
$safeInstitution = ($Institution -replace '[^A-Za-z0-9]+','-').Trim('-').ToLowerInvariant()
$safeView = ($View -replace '[^A-Za-z0-9]+','-').Trim('-').ToLowerInvariant()
$safeCycle = ($Cycle -replace '[^A-Za-z0-9]+','-').Trim('-').ToLowerInvariant()
$safeLatest = if ([string]::IsNullOrWhiteSpace($LatestTransactionVisible)) { 'unknown' } else { ($LatestTransactionVisible -replace '[^A-Za-z0-9]+','-').Trim('-').ToLowerInvariant() }
$archiveName = "${receivedDate}__${safeInstitution}__${safeView}__${safeCycle}__through-${safeLatest}$extension"
$destination = Join-Path $archiveFolder $archiveName

Copy-Item -LiteralPath $SourcePath -Destination $destination

function Escape-Csv([string]$value) { '"' + ($value -replace '"','""') + '"' }
$register = Join-Path $archiveRoot "screenshot-register.csv"
$row = @(
    Escape-Csv (Join-Path (Join-Path (Get-Date -Format 'yyyy') (Get-Date -Format 'yyyy-MM')) $archiveName),
    Escape-Csv $Institution,
    Escape-Csv $View,
    Escape-Csv $receivedDate,
    Escape-Csv $VisibleTransactionRange,
    Escape-Csv $LatestTransactionVisible,
    Escape-Csv $Cycle,
    Escape-Csv $Notes
) -join ','
Add-Content -LiteralPath $register -Value $row
Write-Output "Archived $destination"
