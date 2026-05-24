# expose-lan.ps1
# Script to expose Minikube services to the local LAN (Windows)
# Run with Administrator privileges

param(
    [switch]$Remove    # Use -Remove to delete all rules
)

# ── Get IP Addresses ──────────────────────────────────────────────
$minikubeIp = minikube ip
if (-not $minikubeIp) {
    Write-Error "Minikube is not running. Please run: minikube start"
    exit 1
}

# Get the LAN IP of the host machine (preferring the 192.168.x.x range)
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -match "^192\.168\." -and $_.PrefixOrigin -eq "Dhcp" } |
    Select-Object -First 1).IPAddress

if (-not $lanIp) {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -ne "0.0.0.0" } |
        Select-Object -First 1).IPAddress
}

Write-Host "Minikube IP  : $minikubeIp"
Write-Host "Host LAN IP  : $lanIp"
Write-Host ""

if ($Remove) {
    # ── Remove portproxy rules ──────────────────────────────────
    Write-Host "Removing portproxy rules..." -ForegroundColor Yellow
    netsh interface portproxy delete v4tov4 listenport=8080 listenaddress=0.0.0.0
    netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0

    # Delete firewall rules
    netsh advfirewall firewall delete rule name="Minikube Frontend LAN"
    netsh advfirewall firewall delete rule name="Minikube Backend LAN"

    Write-Host "Done! LAN access has been disabled." -ForegroundColor Green
    exit 0
}

# ── Create portproxy rules ──────────────────────────────────────────
# Frontend: LAN:8080 ──> Minikube:30080
netsh interface portproxy add v4tov4 `
    listenport=8080 listenaddress=0.0.0.0 `
    connectport=30080 connectaddress=$minikubeIp

# Backend API: LAN:3000 ──> Minikube:30000
netsh interface portproxy add v4tov4 `
    listenport=3000 listenaddress=0.0.0.0 `
    connectport=30000 connectaddress=$minikubeIp

# ── Open Windows Firewall ──────────────────────────────────────────
netsh advfirewall firewall add rule `
    name="Minikube Frontend LAN" protocol=TCP dir=in `
    localport=8080 action=allow | Out-Null

netsh advfirewall firewall add rule `
    name="Minikube Backend LAN" protocol=TCP dir=in `
    localport=3000 action=allow | Out-Null

# ── Results ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "✅ LAN access is enabled!" -ForegroundColor Green
Write-Host ""
Write-Host "From another machine on the LAN, access:" -ForegroundColor Cyan
Write-Host "  Frontend : http://${lanIp}:8080"
Write-Host "  Backend  : http://${lanIp}:3000"
Write-Host ""
Write-Host "Stress test with hey (install: go install github.com/rakyll/hey@latest):" -ForegroundColor Cyan
Write-Host "  hey -z 60s -c 50 http://${lanIp}:3000/api/health"
Write-Host ""
Write-Host "Stress test with k6:" -ForegroundColor Cyan
Write-Host "  k6 run --vus 50 --duration 60s script.js"
Write-Host ""
Write-Host "Monitor HPA scaling:" -ForegroundColor Cyan
Write-Host "  kubectl get hpa -w"
Write-Host "  kubectl get pods -w"
Write-Host ""
Write-Host "To disable LAN access, run: .\expose-lan.ps1 -Remove" -ForegroundColor Yellow

# Show all current port proxies
Write-Host ""
Write-Host "Current Portproxy Rules:" -ForegroundColor Gray
netsh interface portproxy show all
