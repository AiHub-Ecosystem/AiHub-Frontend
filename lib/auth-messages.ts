export function getLoginErrorMessage(error?: string, retry = 60) {
  switch (error) {
    case "invalid":
      return "Email hoặc mật khẩu không đúng.";
    case "rate-limited":
      return `Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${retry} giây.`;
    case "unavailable":
      return "Hiện chưa thể đăng nhập. Vui lòng thử lại sau.";
    case "session":
      return "Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.";
    default:
      return null;
  }
}
