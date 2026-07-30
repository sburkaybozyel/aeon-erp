param(
  [Parameter(Mandatory=$true)][string]$AeonUrl,
  [Parameter(Mandatory=$true)][string]$BridgeKey
)

$ErrorActionPreference = 'Stop'
$root = 'C:\AeonPrintBridge'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$agentUrl = "$($AeonUrl.TrimEnd('/'))/print-bridge/AeonPrintBridge.ps1?v=bridge-20260727-4"
Invoke-WebRequest -Uri $agentUrl -OutFile (Join-Path $root 'AeonPrintBridge.ps1') -UseBasicParsing
$config = @{ aeon_url = $AeonUrl.TrimEnd('/'); bridge_key = $BridgeKey; printers = @{ kitchen = @{ name = 'MUTFAK-12341' }; reception = @{ name = 'KASA-8211' } } }
$config | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $root 'config.json') -Encoding UTF8
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$root\AeonPrintBridge.ps1`""
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Aeon Print Bridge' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Aeon Print Bridge'
Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$root\AeonPrintBridge.ps1"
Write-Output 'Aeon Print Bridge kuruldu ve baslatildi.'
