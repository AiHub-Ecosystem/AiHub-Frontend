# SKILL — THÊM MỘT USE CASE MỚI (7 BƯỚC CHUẨN)

Khi cần tạo một tính năng / Use Case mới, Agent BẮT BUỘC thực hiện tuần tự theo 7 bước sau:

---

### Bước 1: Khai báo Domain Entity / Types (nếu chưa có)
- Vị trí: `src/domain/<feature>/entity.ts`
- Định nghĩa các kiểu dữ liệu lõi, business constraints.

### Bước 2: Khai báo Output Ports (nếu cần DB/External)
- Vị trí: `src/application/ports/out/<feature>.repository.ts`
- Định nghĩa interface trừu tượng cho repository hoặc service bên thứ 3.

### Bước 3: Định nghĩa DTO & Validation Schema
- Vị trí: `src/application/dtos/<feature>.dto.ts`
- Sử dụng Zod để tạo schema và suy diễn kiểu (`z.infer`).

### Bước 4: Khai báo Input Port (Use Case Interface)
- Vị trí: `src/application/ports/in/<feature>.port.ts`
- Khai báo chữ ký hàm của Use Case.

### Bước 5: Triển khai Use Case
- Vị trí: `src/application/usecases/<feature>/<name>.usecase.ts`
- Nhận Output Ports qua constructor (Dependency Injection).
- Thực thi business logic và trả về domain data / DTO.

### Bước 6: Viết Unit Test cho Use Case
- Vị trí: `tests/usecases/<name>.test.ts`
- Mock Output Ports để test usecase logic mà không cần DB/Network.

### Bước 7: Nối vào Controller & Wiring tại Composition Root
- Tạo Controller tại `src/adapters/in/http/controllers/`
- Khởi tạo Use Case và truyền vào Router tại `src/index.ts`.
