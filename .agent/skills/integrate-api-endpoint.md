# SKILL — HƯỚNG DẪN TÍCH HỢP HTTP API ENDPOINT MỚI

---

## 1. NGUYÊN TẮC
- Controllers chỉ làm nhiệm vụ: (1) Nhận HTTP Request, (2) Validate qua DTO Zod schema, (3) Gọi Use Case, (4) Trả về JSON qua `ApiResponse.success` hoặc chuyển lỗi cho `next(err)`.
- Không nhét business logic vào Controller.

---

## 2. CÁC BƯỚC THỰC HIỆN

1. **Tạo/Cập nhật Controller**:
   - Vị trí: `src/adapters/in/http/controllers/<feature>.controller.ts`
   - Ví dụ:
   ```typescript
   export class AcademicController {
     constructor(private generateUseCase: IGenerateAcademicSampleUseCase) {}

     generate = async (req: Request, res: Response, next: NextFunction) => {
       try {
         const dto = GenerateLabSampleSchema.parse(req.body);
         const result = await this.generateUseCase.execute(dto);
         return ApiResponse.success(res, result);
       } catch (err) {
         next(err);
       }
     };
   }
   ```

2. **Đăng ký Route**:
   - Gắn Controller method vào Router tương ứng trong `src/adapters/in/http/router.ts`.
   - Áp dụng các middleware bảo vệ (`requireAuth`, `standardRateLimiter`, `authenticateGatewayKey`) nếu cần.
