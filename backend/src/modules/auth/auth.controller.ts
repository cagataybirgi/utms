import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tckn, password } = req.body ?? {};
      const user = await this.service.login(String(tckn ?? ""), String(password ?? ""));
      res.json({ user });
    } catch (e) {
      next(e);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tckn, email } = req.body ?? {};
      const result = await this.service.requestPasswordReset(String(tckn ?? ""), String(email ?? ""));
      res.json(result);
    } catch (e) {
      next(e);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword, confirmPassword } = req.body ?? {};
      const result = await this.service.resetPassword(
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
