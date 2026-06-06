import { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors";
import { User, UserRole } from "../types";
import { AppContainer } from "../container";
import { prisma } from "../prisma-client";
import { prismaUserToDomain } from "../mappers/user-mapper";

export interface AuthenticatedUser {
  userId: string;
  fullName: string;
  roles: UserRole[];
  departmentId?: string;
  facultyId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

const HEADER = "x-mock-user";

export function mockAuthMiddleware(container: AppContainer) {
  const useDatabase = process.env.NODE_ENV !== "test";

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.header(HEADER);
      if (!userId) {
        return next(new UnauthorizedError("Missing x-mock-user header"));
      }

      let user: User | undefined = container.users.findById(userId);

      // After Scenario 1 login against Neon, resolve RBAC from the DB when the
      // in-memory seed copy is not present (e.g. fresh serverless instance).
      if (!user && useDatabase) {
        const row = await prisma.user.findUnique({
          where: { userId },
          include: { password: true },
        });
        if (row) user = prismaUserToDomain(row);
      }

      if (!user) {
        return next(new UnauthorizedError(`Unknown user: ${userId}`));
      }

      req.authUser = toAuthUser(user);
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function toAuthUser(user: User): AuthenticatedUser {
  return {
    userId: user.userId,
    fullName: user.fullName,
    roles: user.roles,
    departmentId: user.departmentId,
    facultyId: user.facultyId,
  };
}
