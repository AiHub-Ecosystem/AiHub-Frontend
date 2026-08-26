# RULE 03 — GIT WORKFLOW & CONVENTIONAL COMMITS

---

## 1. CONVENTIONAL COMMITS
Format chuẩn: `<type>(<scope>): <short description>`

### Các Types hợp lệ:
- `feat`: Tính năng mới cho người dùng hoặc API mới
- `fix`: Sửa lỗi (bug fix)
- `refactor`: Tái cấu trúc code, không thay đổi hành vi bên ngoài
- `perf`: Tối ưu hóa hiệu năng
- `test`: Thêm hoặc cập nhật test cases
- `docs`: Cập nhật tài liệu, README, rules
- `chore`: Cập nhật cấu hình build, dependencies, tooling

### Ví dụ:
- `refactor(arch): migrate backend to hexagonal clean architecture`
- `feat(academic): implement reject-sample usecase with fine-tuning persistence`
- `test(exercise): add unit tests for deterministic LLM generator`

---

## 2. PULL REQUEST CHECKLIST
- [ ] Code tuân thủ kiến trúc Clean Architecture (không import sai tầng).
- [ ] `npm test` pass 100%.
- [ ] `tsc --noEmit` pass (không có lỗi type).
- [ ] Không có file thừa hoặc debug log sót lại.
