# Kubernetes Configuration — Social Media Project

Thư mục này chứa toàn bộ cấu hình Kubernetes cho project, được tổ chức theo pattern **Kustomize base/overlays**.

## Cấu trúc thư mục

```
k8s/
├── base/                        # Blueprint chung, không chứa secret/URL môi trường
│   ├── backend/
│   │   ├── deployment.yaml      # Deployment API server (image: social-backend)
│   │   └── service.yaml         # NodePort 3000→30000, IPVS Least Connection
│   ├── frontend/
│   │   ├── deployment.yaml      # Deployment Nginx (image: social-frontend)
│   │   └── service.yaml         # ClusterIP port 80
│   ├── worker/
│   │   └── deployment.yaml      # Background worker (node infra/workers/worker.js)
│   ├── redis/
│   │   ├── statefulset.yaml     # Redis 7 StatefulSet với PVC 1Gi
│   │   └── service.yaml         # ClusterIP port 6379
│   └── kustomization.yaml
│
└── overlays/
    ├── dev/                     # Môi trường Minikube local
    │   ├── configmap.yaml       # Tất cả biến non-sensitive (backend + frontend)
    │   ├── secret.yaml          # Credentials mã hóa base64
    │   └── kustomization.yaml
    └── prod/                    # Môi trường k3s / Cloud
        ├── configmap.yaml       # Biến production (Supabase prod URL, NODE_ENV=production)
        ├── ingress.yaml         # Nginx Ingress + SSL + EWMA load balancing
        ├── hpa.yaml             # HorizontalPodAutoscaler (backend/frontend/worker)
        └── kustomization.yaml
```

---

## Yêu cầu

- [Minikube](https://minikube.sigs.k8s.io/) >= 1.32
- [kubectl](https://kubernetes.io/docs/tasks/tools/) >= 1.28
- [Kustomize](https://kustomize.io/) (đã tích hợp trong kubectl >= 1.14)
- Docker Desktop đang chạy

---

## Chạy trên Minikube (Dev)

### 1. Khởi động Minikube với IPVS

```bash
# Bật IPVS để dùng Least Connection load balancing cho WebSocket
minikube start --extra-config=kube-proxy.mode=ipvs --cpus=4 --memory=4096
```

### 2. Bật Metrics Server (bắt buộc cho HPA nếu dùng)

```bash
minikube addons enable metrics-server
```

### 3. Build Docker image vào Minikube registry

```bash
# Trỏ Docker CLI vào Minikube's Docker daemon
eval $(minikube docker-env)         # Linux/Mac
# Hoặc trên Windows PowerShell:
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Build images
docker build -t social-backend:latest ./social-backend
docker build -f ./social-frontend/Dockerfile.prod -t social-frontend:latest ./social-frontend
```

### 4. Apply cấu hình dev

```bash
kubectl apply -k k8s/overlays/dev
```

### 5. Kiểm tra trạng thái

```bash
# Xem tất cả resources
kubectl get all

# Theo dõi pods đang khởi động
kubectl get pods -w

# Xem logs backend
kubectl logs -l app=backend -f

# Xem logs worker
kubectl logs -l app=worker -f
```

### 6. Truy cập ứng dụng

```bash
# Lấy URL của backend NodePort
minikube service backend --url

# Hoặc port-forward frontend để dùng trên browser
kubectl port-forward svc/frontend 8080:80
# Truy cập: http://localhost:8080
```

---

## Load Balancing

### Dev (Minikube) — IPVS Least Connection

Được cấu hình trong `base/backend/service.yaml`:

```yaml
annotations:
  service.kubernetes.io/ipvs-scheduler: "lc"
```

Kube-proxy chọn pod đang giữ **ít connection nhất** để nhận request mới.
Phù hợp vì project có WebSocket long-lived + REST API + media upload có độ nặng khác nhau.

### Prod — Nginx Ingress EWMA

Được cấu hình trong `overlays/prod/ingress.yaml`:

```yaml
annotations:
  nginx.ingress.kubernetes.io/load-balance: "ewma"
```

EWMA (Exponential Weighted Moving Average) theo dõi latency của từng upstream pod và **tự động tránh pod đang chậm/overload**.

---

## Auto Scaling (HPA)

Chỉ bật ở môi trường **prod** (`overlays/prod/hpa.yaml`):

| Service | Min Replicas | Max Replicas | Scale khi CPU > |
|---------|-------------|-------------|-----------------|
| backend | 2 | 10 | 60% |
| frontend | 2 | 10 | 60% |
| worker | 1 | 5 | 60% |

Theo dõi HPA đang hoạt động:

```bash
kubectl get hpa -w
```

Stress test để xem scale:

```bash
# Cài k6 hoặc dùng hey
hey -z 60s -c 50 http://$(minikube ip):30000/api/health
```

---

## Secrets & ConfigMap

### Cấu trúc

- **`backend-config`** (ConfigMap): Tất cả biến non-sensitive cho backend — ranking, worker, queue, presence, Supabase URL...
- **`frontend-config`** (ConfigMap): `VITE_*` vars cho frontend build
- **`backend-secret`** (Secret): `REDIS_PASSWORD`, `DATABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ **Quan trọng:** File `overlays/dev/secret.yaml` chứa credentials thật (đã base64). Đảm bảo file này đã được add vào `.gitignore` hoặc dùng **Sealed Secrets** / **External Secrets Operator** cho production.

### Tạo lại base64 khi đổi password

```bash
# Windows PowerShell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("your_new_password"))

# Linux/Mac
echo -n "your_new_password" | base64
```

---

## WebSocket (Socket.io)

Redis Pub/Sub được dùng để đồng bộ WebSocket events giữa nhiều pod backend. Khi scale ngang:

```
Client A → Pod #1 (WS)
Client B → Pod #2 (WS)

Pod #1 publish event → Redis → Pod #1 + Pod #2 nhận
                                     ↓
                              Pod #2 push đến Client B
```

**Không cần Sticky Session** vì Redis đảm bảo tất cả pod đều nhận event.

Ingress prod đã được cấu hình để forward WebSocket đúng cách:

```yaml
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

---

## Expose ra mạng LAN (Stress test từ máy khác)

Minikube chạy trong VM nội bộ — máy khác trong LAN không reach được trực tiếp.
Script `scripts/expose-lan.ps1` dùng `netsh portproxy` để bridge traffic:

```
Máy B (LAN) ──► Host:8080 ──► netsh portproxy ──► Minikube:30080 ──► Frontend Pod
Máy B (LAN) ──► Host:3000 ──► netsh portproxy ──► Minikube:30000 ──► Backend Pod
```

### Bật LAN access

Mở PowerShell với quyền **Administrator**:

```powershell
# Bật expose
.\k8s\scripts\expose-lan.ps1

# Script sẽ in ra địa chỉ LAN để dùng, ví dụ:
#   Frontend : http://192.168.1.10:8080
#   Backend  : http://192.168.1.10:3000
```

### Stress test từ máy khác

Cài [hey](https://github.com/rakyll/hey) hoặc [k6](https://k6.io/):

```bash
# Stress test Backend API (thay IP bằng IP máy host)
hey -z 60s -c 50 -m GET http://192.168.1.10:3000/api/health

# Nhiều concurrent hơn để trigger HPA
hey -z 120s -c 200 http://192.168.1.10:3000/api/posts

# Dùng k6 (tạo file script.js trước)
k6 run --vus 100 --duration 60s script.js
```

### Theo dõi scale up realtime

```bash
# Terminal 1: Xem HPA
kubectl get hpa -w

# Terminal 2: Xem pods scale
kubectl get pods -w

# Terminal 3: Xem resource usage
kubectl top pods
```

### Tắt LAN access

```powershell
.\k8s\scripts\expose-lan.ps1 -Remove
```

> ⚠️ **Lưu ý:** `VITE_BACKEND_URL` trong `frontend-config` đang trỏ về `host.minikube.internal:30000`.
> Nếu muốn frontend phục vụ cho browser từ máy LAN khác thì cần rebuild image với `VITE_BACKEND_URL=http://<LAN_IP>:3000`.
> Với mục đích **stress test API**, chỉ cần gọi thẳng backend không cần frontend.

---

## Quản lý và Xuất Logs (Sau khi Stress Test)

Hệ thống backend sử dụng **Pino Logger** để ghi log. Trong cụm Kubernetes (Dev & Prod), log của toàn bộ Pods được xuất dưới dạng cấu trúc **Raw JSON** ra `stdout` nhằm tránh mất mát dữ liệu khi HPA tự động co giãn pods (khi scale down sẽ xóa pod, dẫn đến mất file ghi cục bộ).

### 1. Kéo toàn bộ logs về máy thật Windows
Để xuất toàn bộ logs của các pod backend về một file JSON duy nhất trên máy host sau khi stress test xong:

```powershell
# Tạo thư mục lưu logs tại máy thật (chạy từ thư mục gốc của project)
mkdir -p logs

# Kéo logs từ tất cả các backend pods (tải toàn bộ từ đầu đến hiện tại)
kubectl logs -l app=backend --all-containers=true --tail=-1 > logs/stress-test-results.json
```

### 2. Các mẹo phân tích file log JSON thu được
File `logs/stress-test-results.json` chứa cấu trúc log chi tiết bao gồm `traceId` để truy vết hành trình của request và các siêu dữ liệu (metadata) khác.

- **Tìm tất cả logs liên quan đến 1 request (qua traceId):**
  ```powershell
  # Trên Windows PowerShell
  Select-String -Path .\logs\stress-test-results.json -Pattern "traceId-cụ-thể-của-bạn"
  ```
- **Lọc toàn bộ log lỗi hệ thống (level >= 50 trong Pino đại diện cho Error/Fatal):**
  ```powershell
  # Lọc nhanh các dòng bị lỗi hệ thống
  Select-String -Path .\logs\stress-test-results.json -Pattern '"level":50'
  ```

---

## Xoá toàn bộ


```bash
# Dev
kubectl delete -k k8s/overlays/dev

# Xoá luôn PVC của Redis (dữ liệu Redis sẽ mất)
kubectl delete pvc redis-data-redis-0
```

---

## Triển khai Production (k3s)

```bash
# 1. Cài Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# 2. Cài cert-manager (SSL tự động)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# 3. Cập nhật domain trong overlays/prod/ingress.yaml và configmap.yaml

# 4. Tạo secret prod (KHÔNG commit lên git)
kubectl create secret generic backend-secret \
  --from-literal=REDIS_PASSWORD=<prod_redis_password> \
  --from-literal=DATABASE_URL=<prod_database_url> \
  --from-literal=SUPABASE_KEY=<prod_supabase_key> \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY=<prod_service_role_key>

# 5. Apply
kubectl apply -k k8s/overlays/prod
```
