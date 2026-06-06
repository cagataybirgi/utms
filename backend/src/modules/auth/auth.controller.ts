import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { tckn, password } = req.body ?? {};
      const user = this.service.login(String(tckn ?? ""), String(password ?? ""));
      res.json({ user });
    } catch (e) {
      next(e);
    }
  };

  forgotPassword = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { tckn, email } = req.body ?? {};
      const result = this.service.requestPasswordReset(String(tckn ?? ""), String(email ?? ""));
      res.json(result);
    } catch (e) {
      next(e);
    }
  };

  resetPassword = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { token, newPassword, confirmPassword } = req.body ?? {};
      const result = this.service.resetPassword(
        String(token ?? ""),
        String(newPassword ?? ""),
        String(confirmPassword ?? ""),
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  };
}
