import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../shared/prisma-client";
import { mockAuthMiddleware } from "../../shared/middleware/mock-auth";
import { UnauthorizedError, ValidationError } from "../../shared/errors";
import { hashPassword, verifyPassword, validatePasswordComplexity } from "../auth/password";
import { AppContainer } from "../../shared/container";

export function buildProfileRouter(container: AppContainer): Router {
  const r = Router();
  const auth = mockAuthMiddleware(container);

  // GET /api/profile — full profile of the authenticated user
  r.get("/", auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) throw new UnauthorizedError();
      const user = await prisma.user.findUnique({ where: { userId: req.authUser.userId } });
      if (!user) throw new UnauthorizedError();
      res.json({
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        tckn: user.tckn,
        phoneNum: user.phoneNum,
        roles: user.roles,
        departmentId: user.departmentId ?? null,
        facultyId: user.facultyId ?? null,
      });
    } catch (e) { next(e); }
  });

  // PATCH /api/profile — update name, email, phone
  r.patch("/", auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) throw new UnauthorizedError();
      const { fullName, email, phoneNum } = req.body as {
        fullName?: string;
        email?: string;
        phoneNum?: string[];
      };
      if (fullName !== undefined && fullName.trim().length < 2) {
        throw new ValidationError("Ad Soyad en az 2 karakter olmalıdır.");
      }
      if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ValidationError("Geçerli bir e-posta adresi giriniz.");
      }
      const updated = await prisma.user.update({
        where: { userId: req.authUser.userId },
        data: {
          ...(fullName !== undefined && { fullName: fullName.trim() }),
          ...(email !== undefined && { email: email.trim() }),
          ...(phoneNum !== undefined && { phoneNum }),
        },
      });
      res.json({
        userId: updated.userId,
        fullName: updated.fullName,
        email: updated.email,
        tckn: updated.tckn,
        phoneNum: updated.phoneNum,
        roles: updated.roles,
        departmentId: updated.departmentId ?? null,
        facultyId: updated.facultyId ?? null,
      });
    } catch (e) { next(e); }
  });

  // POST /api/profile/change-password
  r.post("/change-password", auth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) throw new UnauthorizedError();
      const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
      };
      if (!currentPassword || !newPassword) {
        throw new ValidationError("Mevcut şifre ve yeni şifre gereklidir.");
      }

      const passwordRow = await prisma.password.findUnique({
        where: { userId: req.authUser.userId },
      });
      if (!passwordRow || !verifyPassword(currentPassword, passwordRow.passwordHash)) {
        throw new ValidationError("Mevcut şifre hatalı.");
      }

      const complexityError = validatePasswordComplexity(newPassword);
      if (complexityError) throw new ValidationError(complexityError);

      const newHash = hashPassword(newPassword);
      await prisma.password.update({
        where: { userId: req.authUser.userId },
        data: {
          passwordHash: newHash,
          previousPasswordHashes: {
            push: passwordRow.passwordHash,
          },
          lastChangedAt: new Date(),
          isTemporary: false,
        },
      });

      res.json({ message: "Şifre başarıyla güncellendi." });
    } catch (e) { next(e); }
  });

  return r;
}
