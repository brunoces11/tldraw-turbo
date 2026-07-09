$ErrorActionPreference = "Stop"

$Distro = "Ubuntu"
$WorkDirWin = "C:\Users\Bruno\Desktop\GITHUB\MONITOR_HUB"
$WorkDirWsl = "/mnt/c/Users/Bruno/Desktop/GITHUB/MONITOR_HUB"
$LocalCompose = "C:\Users\Bruno\Desktop\compose\hub_monitor.yml"
$Image = "ghcr.io/brunoces11/monitor-hub"
$Vps = "contabo"
$RemoteCompose = "/compose/hub_monitor.yml"

wsl -d $Distro -u root -- bash -lc 'systemctl start docker && docker info >/dev/null'

cd $WorkDirWin

$ComposeText = Get-Content $LocalCompose -Raw
$VersionMatch = [regex]::Match($ComposeText, 'image:\s*ghcr\.io/brunoces11/monitor-hub:v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)')
if (-not $VersionMatch.Success) {
  throw "Nao foi possivel identificar a versao atual em $LocalCompose"
}

$Major = [int]$VersionMatch.Groups['major'].Value
$Minor = [int]$VersionMatch.Groups['minor'].Value
$Patch = [int]$VersionMatch.Groups['patch'].Value + 1
$Version = "v$Major.$Minor.$Patch"

$Commit = git rev-parse --short HEAD

gh auth token | wsl -d $Distro -u root -- docker login ghcr.io -u brunoces11 --password-stdin

wsl -d $Distro -u root -- docker build `
  -t "${Image}:${Version}" `
  -t "${Image}:${Commit}" `
  -t "${Image}:latest" `
  $WorkDirWsl

wsl -d $Distro -u root -- docker push "${Image}:${Version}"
wsl -d $Distro -u root -- docker push "${Image}:${Commit}"
wsl -d $Distro -u root -- docker push "${Image}:latest"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LocalBackup = "$LocalCompose`_bak_$Timestamp"
Copy-Item $LocalCompose $LocalBackup -Force

$ComposeText = $ComposeText -replace "image:\s*ghcr\.io/brunoces11/monitor-hub:[^\r\n]+", "image: ${Image}:${Version}"
Set-Content -Path $LocalCompose -Value $ComposeText -Encoding UTF8

scp $LocalCompose "${Vps}:${RemoteCompose}"

$RemoteCmd = @"
set -e

cd /compose

docker compose -f hub_monitor.yml pull
docker compose -f hub_monitor.yml up -d --force-recreate

echo ""
echo "===== STATUS ====="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "hub_monitor|NAMES"

echo ""
echo "===== IMAGEM EM USO ====="
docker inspect hub_monitor --format='{{.Config.Image}}'

echo ""
echo "===== VOLUMES ====="
docker inspect hub_monitor --format='{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'

echo ""
echo "===== LOGS ====="
docker logs --tail=80 hub_monitor
"@

$RemoteCmd | ssh $Vps "bash -s"

Write-Host ""
Write-Host "✅ Upgrade concluido:"
Write-Host "${Image}:${Version}"
Write-Host "${Image}:${Commit}"
Write-Host "${Image}:latest"
Write-Host "Backup local: $LocalBackup"
