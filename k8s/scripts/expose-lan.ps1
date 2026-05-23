# expose-lan.ps1
# Script expose Minikube services ra mạng LAN (Windows)
# Chạy với quyền Administrator

param(
    [switch]$Remove    # Dùng -Remove để gỡ bỏ toàn bộ rules
)

# ── Lấy địa chỉ IP ──────────────────────────────────────────────
$minikubeIp = minikube ip
if (-not $minikubeIp) {
    Write-Error "Minikube chưa chạy. Hãy chạy: minikube start"
    exit 1
}

# Lấy LAN IP của máy host (ưu tiên dải 192.168.x.x)
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
    # ── Gỡ bỏ portproxy rules ──────────────────────────────────
    Write-Host "Đang xoá portproxy rules..." -ForegroundColor Yellow
    netsh interface portproxy delete v4tov4 listenport=8080 listenaddress=0.0.0.0
    netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0

    # Xoá firewall rules
    netsh advfirewall firewall delete rule name="Minikube Frontend LAN"
    netsh advfirewall firewall delete rule name="Minikube Backend LAN"

    Write-Host "Done! LAN access đã bị tắt." -ForegroundColor Green
    exit 0
}

# ── Tạo portproxy rules ──────────────────────────────────────────
# Frontend: LAN:8080 → Minikube:30080
netsh interface portproxy add v4tov4 `
    listenport=8080 listenaddress=0.0.0.0 `
    connectport=30080 connectaddress=$minikubeIp

# Backend API: LAN:3000 → Minikube:30000
netsh interface portproxy add v4tov4 `
    listenport=3000 listenaddress=0.0.0.0 `
    connectport=30000 connectaddress=$minikubeIp

# ── Mở Windows Firewall ──────────────────────────────────────────
netsh advfirewall firewall add rule `
    name="Minikube Frontend LAN" protocol=TCP dir=in `
    localport=8080 action=allow | Out-Null

netsh advfirewall firewall add rule `
    name="Minikube Backend LAN" protocol=TCP dir=in `
    localport=3000 action=allow | Out-Null

# ── Kết quả ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "✅ LAN access đã bật!" -ForegroundColor Green
Write-Host ""
Write-Host "Từ máy khác trong mạng LAN, truy cập:" -ForegroundColor Cyan
Write-Host "  Frontend : http://${lanIp}:8080"
Write-Host "  Backend  : http://${lanIp}:3000"
Write-Host ""
Write-Host "Stress test với hey (cài: go install github.com/rakyll/hey@latest):" -ForegroundColor Cyan
Write-Host "  hey -z 60s -c 50 http://${lanIp}:3000/api/health"
Write-Host ""
Write-Host "Stress test với k6:" -ForegroundColor Cyan
Write-Host "  k6 run --vus 50 --duration 60s script.js"
Write-Host ""
Write-Host "Theo dõi HPA scale:" -ForegroundColor Cyan
Write-Host "  kubectl get hpa -w"
Write-Host "  kubectl get pods -w"
Write-Host ""
Write-Host "Để tắt LAN access: .\expose-lan.ps1 -Remove" -ForegroundColor Yellow

# Hiện tất cả portproxy hiện tại
Write-Host ""
Write-Host "Portproxy rules hiện tại:" -ForegroundColor Gray
netsh interface portproxy show all
