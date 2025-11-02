# version-helper.ps1 - Helper script pour extraire et modifier les versions
param(
    [Parameter(Mandatory=$true)]
    [string]$Action,

    [string]$NewVersionCode,
    [string]$NewVersionName
)

$buildGradleFile = "app\build.gradle.kts"

if (-not (Test-Path $buildGradleFile)) {
    Write-Error "Fichier $buildGradleFile introuvable!"
    exit 1
}

$content = Get-Content $buildGradleFile -Raw

switch ($Action) {
    "GetVersionCode" {
        if ($content -match 'versionCode\s*=\s*(\d+)') {
            Write-Output $matches[1]
        } else {
            Write-Error "versionCode non trouve!"
            exit 1
        }
    }

    "GetVersionName" {
        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            Write-Output $matches[1]
        } else {
            Write-Error "versionName non trouve!"
            exit 1
        }
    }

    "IncrementAlpha" {
        # Prend la version actuelle et incremente le suffixe alpha
        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            $currentVersion = $matches[1]
            if ($currentVersion -match '^(.+-alpha\.)(\d+)$') {
                $baseVersion = $matches[1]
                $alphaNum = [int]$matches[2] + 1
                Write-Output ($baseVersion + $alphaNum)
            } else {
                # Si pas de suffixe alpha, retourner la version telle quelle
                Write-Output $currentVersion
            }
        } else {
            Write-Error "versionName non trouve!"
            exit 1
        }
    }

    "UpdateVersions" {
        if (-not $NewVersionCode -or -not $NewVersionName) {
            Write-Error "NewVersionCode et NewVersionName requis pour UpdateVersions"
            exit 1
        }

        # Remplacer versionCode
        $content = $content -replace 'versionCode\s*=\s*\d+', "versionCode = $NewVersionCode"

        # Remplacer versionName
        $content = $content -replace 'versionName\s*=\s*"[^"]+"', "versionName = `"$NewVersionName`""

        # Sauvegarder le fichier
        Set-Content -Path $buildGradleFile -Value $content -NoNewline -Encoding UTF8

        Write-Output "OK"
    }

    default {
        Write-Error "Action inconnue: $Action"
        exit 1
    }
}
