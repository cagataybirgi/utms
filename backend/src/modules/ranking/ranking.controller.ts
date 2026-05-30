import { Request, Response } from "express";
import { z } from "zod";
import { RankingService } from "./ranking.service";
import { UnauthorizedError } from "../../shared/errors";

const ExecuteRankingSchema = z.object({
  departmentId: z.string().min(1, "departmentId is required"),
  periodId: z.string().min(1, "periodId is required"),
  quota: z.number().int().positive("Quota must be a positive number"),
});

export class RankingController {
  constructor(private readonly service: RankingService) {}

  execute = (req: Request, res: Response): void => {
    const userId = this.requireUser(req);
    const body = ExecuteRankingSchema.parse(req.body);

    const result = this.service.executeRanking({
      departmentId: body.departmentId,
      periodId: body.periodId,
      quota: body.quota,
      actorUserId: userId,
    });

    res.json({
      ...result,
      message: `Ranking completed: ${result.eligible} eligible, ${result.asilCount} Asil, ${result.yedekCount} Yedek, ${result.redCount} Red`,
    });
  };

  getResults = (req: Request, res: Response): void => {
    this.requireUser(req);
    const { departmentId, periodId } = req.params;

    const results = this.service.getRankingResults(departmentId, periodId);

    res.json({
      results,
      message: `Retrieved ${results.length} ranked applications`,
    });
  };

  getOverview = (req: Request, res: Response): void => {
    this.requireUser(req);
    const { departmentId, periodId } = req.params;

    const overview = this.service.getDepartmentOverview(departmentId, periodId);

    res.json({
      overview,
      message: "Department ranking overview retrieved",
    });
  };

  private requireUser(req: Request): string {
    if (!req.authUser) throw new UnauthorizedError();
    return req.authUser.userId;
  }
}
