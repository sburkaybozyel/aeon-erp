$ErrorActionPreference = 'Continue'
$logPath = Join-Path $PSScriptRoot 'bridge.log'

function Write-BridgeLog($message) {
  "$(Get-Date -Format s) $message" | Add-Content -Path $logPath
}

$mutex = New-Object System.Threading.Mutex($false, "AeonPrintBridge_$env:USERNAME")
if (-not $mutex.WaitOne(0, $false)) { exit 0 }

try {
  $configPath = Join-Path $PSScriptRoot 'config.json'
  $config = Get-Content $configPath -Raw | ConvertFrom-Json
  Write-BridgeLog "baslatildi: $($config.aeon_url)"

function Send-WindowsTicket($printerName, $job) {
  Add-Type -AssemblyName System.Drawing
  $payload = $job.payload
  $printLines = @("Sipariş: $($job.request_id)", "Hedef: $($payload.target)", "Personel: $($payload.created_by)", "Tarih: $($job.created_at)", "--------------------------------")
  foreach ($line in $payload.lines) {
    $printLines += "$($line.quantity) x $($line.name)"
    if ($line.modifiers) { $printLines += "  $($line.modifiers)" }
    if ($line.allergen_notes) { $printLines += "  Not: $($line.allergen_notes)" }
  }
  $printLines += "--------------------------------"
  $title = if ($payload.title) { [string]$payload.title } else { 'SİPARİŞ FİŞİ' }
  $document = New-Object System.Drawing.Printing.PrintDocument
  $document.PrinterSettings.PrinterName = $printerName
  $document.DocumentName = "Aeon $($job.request_id)"
  $document.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(6, 6, 6, 6)
  $document.PrintController = New-Object System.Drawing.Printing.StandardPrintController
  $handler = {
    param($sender, $eventArgs)
    $titleFont = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold)
    $bodyFont = New-Object System.Drawing.Font('Arial', 12, [System.Drawing.FontStyle]::Bold)
    $y = $eventArgs.MarginBounds.Top
    $eventArgs.Graphics.DrawString($title, $titleFont, [System.Drawing.Brushes]::Black, $eventArgs.MarginBounds.Left, $y)
    $y += $titleFont.GetHeight($eventArgs.Graphics) + 12
    foreach ($line in $printLines) {
      $eventArgs.Graphics.DrawString($line, $bodyFont, [System.Drawing.Brushes]::Black, $eventArgs.MarginBounds.Left, $y)
      $y += $bodyFont.GetHeight($eventArgs.Graphics) + 5
    }
    $titleFont.Dispose()
    $bodyFont.Dispose()
  }.GetNewClosure()
  $document.add_PrintPage($handler)
  try { $document.Print() } finally { $document.Dispose() }
}

function Invoke-BridgeRequest($method, $path, $body = $null) {
  $headers = @{ 'x-aeon-print-key' = $config.bridge_key }
  $params = @{ Method = $method; Uri = "$($config.aeon_url)$path"; Headers = $headers; UseBasicParsing = $true }
  if ($null -ne $body) {
    $params.ContentType = 'application/json'
    $params.Body = ($body | ConvertTo-Json -Compress)
  }
  return Invoke-RestMethod @params
}

while ($true) {
  try {
    $jobs = Invoke-BridgeRequest 'GET' "/api/print-bridge/jobs?station=all"
    foreach ($job in $jobs) {
      $station = $job.station
      $target = $config.printers.$station
      if (-not $target -or [string]::IsNullOrWhiteSpace([string]$target.name)) { continue }
      try {
        Send-WindowsTicket $target.name $job
        Invoke-BridgeRequest 'POST' "/api/print-bridge/jobs/$($job.id)/complete" @{ station = $station } | Out-Null
        Write-BridgeLog "$station $($job.id) yazdirildi"
      } catch {
        Invoke-BridgeRequest 'POST' "/api/print-bridge/jobs/$($job.id)/failed" @{ station = $station; error = $_.Exception.Message } | Out-Null
        Write-BridgeLog "$station $($job.id) hata: $($_.Exception.Message)"
      }
    }
  } catch {
    Write-BridgeLog "baglanti hata: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 15
}
} catch {
  Write-BridgeLog "baslatma hata: $($_.Exception.Message)"
} finally {
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
}
