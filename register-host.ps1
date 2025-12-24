# Register Native Messaging Host for Chrome
$ManifestPath = Resolve-Path ".\src\desktop\native-host\com.genpwd.pro.host.json"
$RegistryKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.genpwd.pro.host"

if (!(Test-Path $RegistryKey)) {
    New-Item -Path $RegistryKey -Force | Out-Null
}

Set-ItemProperty -Path $RegistryKey -Name "(Default)" -Value $ManifestPath
Write-Host "Registered Native Host at $RegistryKey"
