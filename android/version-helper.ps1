# version-helper.ps1 - Helper script pour extraire et modifier les versions
# Version 2.0 - Enhanced with more features and better error handling

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("GetVersionCode", "GetVersionName", "IncrementAlpha", "IncrementBeta", "IncrementMinor", "IncrementMajor", "UpdateVersions", "GetFullVersion", "ValidateVersion")]
    [string]$Action,

    [string]$NewVersionCode,
    [string]$NewVersionName
)

$buildGradleFile = "app\build.gradle.kts"

# Fonction pour log des messages
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

# Verification de l'existence du fichier
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
            Write-Error "versionCode non trouve dans le fichier!"
            exit 1
        }
    }

    "GetVersionName" {
        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            Write-Output $matches[1]
        } else {
            Write-Error "versionName non trouve dans le fichier!"
            exit 1
        }
    }

    "GetFullVersion" {
        # Retourne versionName (versionCode)
        $versionCode = ""
        $versionName = ""

        if ($content -match 'versionCode\s*=\s*(\d+)') {
            $versionCode = $matches[1]
        }
        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            $versionName = $matches[1]
        }

        if ($versionCode -and $versionName) {
            Write-Output "$versionName ($versionCode)"
        } else {
            Write-Error "Impossible de lire la version complete!"
            exit 1
        }
    }

    "IncrementAlpha" {
        # Incremente le suffixe alpha (1.2.0-alpha.15 -> 1.2.0-alpha.16)
        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            $currentVersion = $matches[1]
            if ($currentVersion -match '^(.+-alpha\.)(\d+)$') {
                $baseVersion = $matches[1]
                $alphaNum = [int]$matches[2] + 1
                Write-Output ($baseVersion + $alphaNum)
            } else {
                # Si pas de suffixe alpha, ajouter .alpha.1
                Write-Output ($currentVersion + "-alpha.1")
            }
        } else {
            Write-Error "versionName non trouve!"
            exit 1
        }
    }

    "IncrementBeta" {
        # Incremente le suffixe beta (1.2.0-beta.5 -> 1.2.0-beta.6)
        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            $currentVersion = $matches[1]
            if ($currentVersion -match '^(.+-beta\.)(\d+)$') {
                $baseVersion = $matches[1]
                $betaNum = [int]$matches[2] + 1
                Write-Output ($baseVersion + $betaNum)
            } else {
                # Si pas de suffixe beta, ajouter .beta.1
                if ($currentVersion -match '^(.+)-alpha\.\d+$') {
                    # Passage de alpha a beta
                    $baseVersion = $matches[1]
                    Write-Output ($baseVersion + "-beta.1")
                } else {
                    Write-Output ($currentVersion + "-beta.1")
                }
            }
        } else {
            Write-Error "versionName non trouve!"
            exit 1
        }
    }

    "IncrementMinor" {
        # Incremente la version mineure (1.2.0 -> 1.3.0)
        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            $currentVersion = $matches[1]
            # Extraire la partie de base sans suffixe
            $baseVersion = $currentVersion -replace '-.*$', ''

            if ($baseVersion -match '^(\d+)\.(\d+)\.(\d+)$') {
                $major = [int]$matches[1]
                $minor = [int]$matches[2] + 1
                $patch = 0  # Reset patch a 0
                Write-Output "$major.$minor.$patch-alpha.1"
            } else {
                Write-Error "Format de version invalide: $baseVersion"
                exit 1
            }
        } else {
            Write-Error "versionName non trouve!"
            exit 1
        }
    }

    "IncrementMajor" {
        # Incremente la version majeure (1.2.0 -> 2.0.0)
        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            $currentVersion = $matches[1]
            # Extraire la partie de base sans suffixe
            $baseVersion = $currentVersion -replace '-.*$', ''

            if ($baseVersion -match '^(\d+)\.(\d+)\.(\d+)$') {
                $major = [int]$matches[1] + 1
                $minor = 0  # Reset minor a 0
                $patch = 0  # Reset patch a 0
                Write-Output "$major.$minor.$patch-alpha.1"
            } else {
                Write-Error "Format de version invalide: $baseVersion"
                exit 1
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

        # Valider le format de la nouvelle version
        if ($NewVersionName -notmatch '^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$') {
            Write-Warning "Format de version inhabituel: $NewVersionName"
            Write-Warning "Format attendu: X.Y.Z ou X.Y.Z-alpha.N"
        }

        # Sauvegarder une copie de backup
        $backupFile = $buildGradleFile + ".backup"
        Copy-Item $buildGradleFile $backupFile -Force
        Write-Log "Backup cree: $backupFile"

        # Remplacer versionCode
        $newContent = $content -replace 'versionCode\s*=\s*\d+', "versionCode = $NewVersionCode"

        # Remplacer versionName
        $newContent = $newContent -replace 'versionName\s*=\s*"[^"]+"', "versionName = `"$NewVersionName`""

        # Verifier que les changements ont ete appliques
        if ($newContent -notmatch "versionCode = $NewVersionCode") {
            Write-Error "Echec de mise a jour du versionCode!"
            exit 1
        }
        if ($newContent -notmatch "versionName = `"$NewVersionName`"") {
            Write-Error "Echec de mise a jour du versionName!"
            exit 1
        }

        # Sauvegarder le fichier (UTF8 sans BOM pour compatibilite)
        try {
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            [System.IO.File]::WriteAllText($buildGradleFile, $newContent, $utf8NoBom)
            Write-Log "Fichier mis a jour avec succes"
            Write-Log "  versionCode: $NewVersionCode"
            Write-Log "  versionName: $NewVersionName"
            Write-Output "OK"
        } catch {
            Write-Error "Erreur lors de l'ecriture du fichier: $_"
            # Restaurer le backup
            Copy-Item $backupFile $buildGradleFile -Force
            Write-Error "Backup restaure"
            exit 1
        }
    }

    "ValidateVersion" {
        # Valide que le fichier contient des versions valides
        $valid = $true
        $versionCode = ""
        $versionName = ""

        if ($content -match 'versionCode\s*=\s*(\d+)') {
            $versionCode = $matches[1]
            if ([int]$versionCode -lt 1) {
                Write-Warning "versionCode doit etre >= 1 (trouve: $versionCode)"
                $valid = $false
            }
        } else {
            Write-Error "versionCode non trouve!"
            $valid = $false
        }

        if ($content -match 'versionName\s*=\s*"([^"]+)"') {
            $versionName = $matches[1]
            if ($versionName -notmatch '^\d+\.\d+\.\d+') {
                Write-Warning "versionName devrait suivre le format X.Y.Z (trouve: $versionName)"
                $valid = $false
            }
        } else {
            Write-Error "versionName non trouve!"
            $valid = $false
        }

        if ($valid) {
            Write-Log "Validation OK" -Level "SUCCESS"
            Write-Log "  versionCode: $versionCode"
            Write-Log "  versionName: $versionName"
            Write-Output "OK"
        } else {
            Write-Error "Validation echouee!"
            exit 1
        }
    }

    default {
        Write-Error "Action inconnue: $Action"
        Write-Host "Actions disponibles:"
        Write-Host "  GetVersionCode    - Obtenir le versionCode actuel"
        Write-Host "  GetVersionName    - Obtenir le versionName actuel"
        Write-Host "  GetFullVersion    - Obtenir la version complete (versionName + versionCode)"
        Write-Host "  IncrementAlpha    - Incrementer le numero alpha (X.Y.Z-alpha.N -> X.Y.Z-alpha.N+1)"
        Write-Host "  IncrementBeta     - Incrementer le numero beta (X.Y.Z-beta.N -> X.Y.Z-beta.N+1)"
        Write-Host "  IncrementMinor    - Incrementer la version mineure (X.Y.Z -> X.Y+1.0-alpha.1)"
        Write-Host "  IncrementMajor    - Incrementer la version majeure (X.Y.Z -> X+1.0.0-alpha.1)"
        Write-Host "  UpdateVersions    - Mettre a jour versionCode et versionName"
        Write-Host "  ValidateVersion   - Valider le format des versions"
        exit 1
    }
}
