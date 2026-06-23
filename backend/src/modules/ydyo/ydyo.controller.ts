import { Request, Response } from "express";
import { z } from "zod";
import { YdyoService } from "./ydyo.service";
import { UnauthorizedError } from "../../shared/errors";

const DecisionSchema = z.object({
  decision: z.enum(["SUCCESSFUL", "UNSUCCESSFUL", "EXEMPT"]),
  notes: z.string().optional(),
});

export class YdyoController {
  constructor(private readonly service: YdyoService) {}

  listQueue = async (_req: Request, res: Response): Promise<void> => {
    res.json({ items: await this.service.listQueue() });
  };

  getDetail = async (req: Request, res: Response): Promise<void> => {
    const { applicationId } = req.params;
    res.json(await this.service.detail(applicationId));
  };

  decide = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const { applicationId } = req.params;
    const body = DecisionSchema.parse(req.body);
    const application = await this.service.decide(applicationId, userId, body);
    res.json({ application, message: "Language review recorded." });
  };

  private requireUser(req: Request): string {
    if (!req.authUser) throw new UnauthorizedError();
    return req.authUser.userId;
  }
}
