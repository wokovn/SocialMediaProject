# PROJECT BLUEPRINT: Social Z - High-Performance Backend System

- **Role**: Backend Engineering
- **Tech Stack**: Express.js (Node.js), PostgreSQL, Redis, Docker, Cloudinary/AWS S3.
- **Architecture**: Modular Monolith (Domain-Driven Design aligned).

## 0. Architectural Strategy & Design Principles (The Foundation)

**Mục tiêu**: Định hướng kiến trúc dài hạn, đảm bảo khả năng mở rộng từ 100 lên 1.000.000 users mà không cần đập đi xây lại.

### 0.1. Modular Monolith Architecture
**Tại sao không phải Microservices ngay từ đầu?** Vì Microservices quá phức tạp cho team nhỏ. Chúng ta chọn Modular Monolith:
- **Module Boundaries**: Chia hệ thống thành các module độc lập theo nghiệp vụ (`UserModule`, `PostModule`, `InteractionModule`).
- **Encapsulation**: Các module chỉ giao tiếp với nhau qua Public Service/API, **TUYỆT ĐỐI KHÔNG** import trực tiếp Repository của module khác. Điều này giúp sau này nếu cần tách `PostModule` ra thành một Microservice riêng biệt, ta chỉ cần sửa lại lớp giao tiếp là xong.

### 0.2. Scalability Mindset (Tư duy mở rộng)
- **Stateless Application**: Server không được lưu trạng thái user (như session) trong RAM. Mọi trạng thái phải lưu ở Redis hoặc Client (JWT). Điều này cho phép ta chạy 10 hay 100 cái container (Horizontal Scaling) mà không gặp lỗi.
- **Asynchronous Processing**: Các tác vụ nặng (gửi email, nén video, thông báo) phải được đẩy vào Message Queue (Redis/BullMQ) để xử lý nền. Không bắt user phải chờ.

---

## Phase 1: Infrastructure & Environment Setup
**Mục tiêu**: Xây dựng nền tảng hạ tầng vững chắc, chuẩn hóa môi trường Dev/Prod.

### 1.1. Project Initialization (Standardized)
- [ ] **Express.js Setup**: Khởi tạo project Express với `npm init` và cài đặt Express (Package Manager: `npm` hoặc `pnpm`).
- [ ] **Linting & Formatting**: Cấu hình ESLint và Prettier strict rules.
- [ ] **Git Hooks**: `husky` & `commitlint` để chặn commit rác.

### 1.2. Containerization (Docker Architecture)
- [ ] **Docker Compose Services**: `postgres`, `redis`, `pgadmin`.
- [ ] **Network Isolation**: Cấu hình Docker Network riêng biệt.

### 1.3. Configuration Management
- [ ] **ConfigModule & Joi Validation**: Quản lý biến môi trường chặt chẽ, fail-fast nếu thiếu config.

---

## Phase 2: Database Architecture & ORM
**Mục tiêu**: Thiết kế Schema tối ưu, đảm bảo tính toàn vẹn và hiệu năng đọc/ghi.

### 2.1. Advanced ORM Setup (TypeORM hoặc Sequelize)
- [ ] **Async Configuration**: Load config an toàn.
- [ ] **Replication Setup (Future Proof)**: Cấu hình ORM để hỗ trợ Read/Write splitting (Ghi vào Master, Đọc từ Slaves) khi lượng user tăng cao.

### 2.2. Entity Design (DDD Approach)
- [ ] **Base Abstract Entity**: `id` (UUID), `createdAt`, `updatedAt`, `deletedAt`.
- [ ] **Indexes**: Đánh index cho các cột hay query (`email`, `username`, `slug`).
- [ ] **Foreign Keys**: Thiết lập ràng buộc khóa ngoại chặt chẽ (`ON DELETE CASCADE`/`SET NULL`) để giữ sạch data.

### 2.3. Migrations & Seeding
- [ ] **Migration Scripts**: Quản lý thay đổi DB bằng version control.
- [ ] **Data Seeding**: Script tạo dữ liệu mẫu lớn để test performance query.

---

## Phase 3: Advanced Authentication & Authorization
**Mục tiêu**: Bảo mật đa lớp, Zero-Trust network.

### 3.1. Dual-Token Architecture
- [ ] **Access Token (Short-lived)**: 15 phút.
- [ ] **Refresh Token (Long-lived)**: 7 ngày, lưu hash trong DB, có cơ chế Revoke (thu hồi) khẩn cấp.
- [ ] **Argon2 Hashing**: Chuẩn bảo mật password mới nhất.

### 3.2. Role-Based Access Control (RBAC)
- [ ] **Middleware & Custom Functions**: Xây dựng middleware kiểm tra roles và policies (VD: `requireRole('ADMIN')`, `requirePolicy('UPDATE_POST')`). Thiết kế phân quyền linh động.

---

## Phase 4: Business Logic & Maintainability
**Mục tiêu**: Code dễ đọc, dễ sửa, tuân thủ SOLID.

### 4.1. Clean Code & Patterns
- [ ] **Service Layer**: Chứa toàn bộ logic nghiệp vụ. Router/Controller chỉ làm nhiệm vụ điều hướng và Validate input.
- [ ] **Validation**: Validate chặt chẽ mọi input bằng `express-validator`, `joi`, hoặc `zod`.

### 4.2. Feature Engineering
- [ ] **File Upload**: Abstract hóa storage provider (S3/Cloudinary/Local).
- [ ] **Feed Algorithm**: Cursor-based Pagination + Query Optimization (tránh N+1 problem).

---

## Phase 5: Reliability, Scalability & Async Processing
**Mục tiêu**: Hệ thống chịu tải cao, phản hồi nhanh.

### 5.1. Caching Strategy (Redis)
- [ ] **Cache-Aside**: Cache dữ liệu đọc nhiều.
- [ ] **Cache Stampede Prevention**: Cơ chế lock để tránh hàng ngàn request cùng query DB khi cache hết hạn.

### 5.2. Queue & Background Jobs (BullMQ hoặc Bull)
- [ ] **Task Queue**: Xử lý việc gửi Email Welcome, Resize ảnh upload, Push Notification trong background workers. Giúp API phản hồi ngay lập tức (<100ms).

### 5.3. Rate Limiting & Circuit Breaker
- [ ] **Throttling**: Chống DDoS tầng ứng dụng.
- [ ] **Circuit Breaker**: Ngắt kết nối tạm thời đến các service bên thứ 3 (như Email Service) nếu chúng bị lỗi, tránh làm treo cả hệ thống.

---

## Phase 6: Maintainability, DevOps & Quality Assurance
**Mục tiêu**: "Code là để đọc", giảm thiểu nợ kỹ thuật (Technical Debt).

### 6.1. Testing Strategy (The Testing Pyramid)
- [ ] **Unit Tests**: Che phủ 100% logic phức tạp trong Services.
- [ ] **Integration Tests**: Test tương tác giữa API và Database/Redis (dùng `Testcontainers`).

### 6.2. Documentation
- [ ] **Swagger/OpenAPI**: Auto-generated API Docs (s\u1eed d\u1ee5ng `swagger-jsdoc` v\u00e0 `swagger-ui-express`).

### 6.3. Observability (Logging & Monitoring)
- [ ] **Structured Logging**: Sử dụng `winston` hoặc `pino` để log dạng JSON (`context`, `traceId`) để dễ dàng truy vết lỗi trên các công cụ như ELK Stack hoặc Loki.
- [ ] **Health Checks**: Endpoint `/health` để K8s/Load Balancer biết trạng thái service.

## Follow Reliability TODO
- [ ] Improve follow write-behind reliability: bootstrap Redis follow sets from DB on startup and expose pending follow state to avoid temporary follower-count drift before batch sync.