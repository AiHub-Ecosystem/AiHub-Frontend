# RULE 00 — CLEAN & HEXAGONAL ARCHITECTURE GUIDELINES

> **Quy tắc bất biến:** Chiều phụ thuộc luôn hướng vào trong. Lõi Domain và Application không bao giờ biết đến Database, Framework hoặc bên ngoài.

---

## 1. PHÂN TẦNG VÀ TRÁCH NHIỆM

```text
src/
├── domain/        # [TẦNG 1] Entities, Value Objects, Domain Errors, Taxonomy
├── application/   # [TẦNG 2] Use Cases, Ports (In/Out), DTOs (Request/Response validation)
├── adapters/      # [TẦNG 3] 
│   ├── in/        # Driving Adapters: HTTP Controllers, Middlewares, Routers
│   └── out/       # Driven Adapters: Persistence (Prisma, Memory), LLM Clients, 3rd Party
├── pkg/           # [TẦNG DÙNG CHUNG] Logger, ApiResponse, AppErrors
└── config/        # Environment Config
```

### 1.1. Tầng Domain (`src/domain/`)
- **Được phép:** Viết pure TypeScript types, interfaces, business rules, validation logic của domain, taxonomy.
- **Nghiêm cấm:** 
  - KHÔNG import `@prisma/client`, `express`, `openai`, `@google/generative-ai`, axios/fetch.
  - KHÔNG import từ `src/application/` hay `src/adapters/`.

### 1.2. Tầng Application (`src/application/`)
- **Input Ports (`ports/in/`)**: Định nghĩa interface mà các Use Cases cung cấp cho Adapters In (Controllers) gọi.
- **Output Ports (`ports/out/`)**: Định nghĩa interface mà Use Case yêu cầu (Repositories, LLM Providers, Notification Services).
- **DTOs (`dtos/`)**: Chứa Zod schema để validate input từ bên ngoài chuyển vào Use Case.
- **Use Cases (`usecases/`)**: Triển khai logic nghiệp vụ điều phối. Chỉ giao tiếp với DB hoặc dịch vụ bên ngoài thông qua Output Ports.
- **Nghiêm cấm:** KHÔNG import trực tiếp Express `Request`/`Response`, không gọi trực tiếp DB client instance.

### 1.3. Tầng Adapters (`src/adapters/`)
- **Adapters In (`adapters/in/`)**: 
  - Controllers nhận Express `Request`, validate bằng DTO, gọi Use Case thông qua Port, trả về HTTP status & JSON qua `ApiResponse`.
- **Adapters Out (`adapters/out/`)**:
  - Triển khai cụ thể các Output Ports: Prisma Repositories, Memory Repositories, Gemini/OpenAI API Clients.

---

## 2. CẤM IMPORT VÒNG (CIRCULAR DEPENDENCIES)
- `adapters` $\rightarrow$ `application` $\rightarrow$ `domain`
- KHÔNG BAO GIỜ: `domain` $\rightarrow$ `application` $\rightarrow$ `adapters`
- KHÔNG BAO GIỜ: Một Adapter gọi trực tiếp một Adapter khác mà không thông qua Use Case / Application layer.
