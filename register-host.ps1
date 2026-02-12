# Register Native Messaging Host for Chrome
$ManifestPath = (Resolve-Path ".\native-host\com.genpwdpro.nmh.json").Path
$RegistryKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.genpwdpro.nmh"

if (!(Test-Path $RegistryKey)) {
    New-Item -Path $RegistryKey -Force | Out-Null
}

Set-ItemProperty -Path $RegistryKey -Name "(Default)" -Value $ManifestPath
Write-Host "Registered Native Host at $RegistryKey"
