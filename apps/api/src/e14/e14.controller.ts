import { Controller, Get, Post, Query, Body, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { E14Service } from "./e14.service";

@Controller("e14")
export class E14Controller {
  constructor(private readonly service: E14Service) {}

  /** GET /api/e14/stats — progreso del pipeline de descarga y OCR */
  @Get("stats")
  pipelineStats() {
    return this.service.pipelineStats();
  }

  /** GET /api/e14/recent?limit=20 — actas procesadas recientemente */
  @Get("recent")
  recent(@Query("limit") limit?: string) {
    return this.service.recent(limit ? parseInt(limit, 10) : 20);
  }

  /** GET /api/e14/fraud-check?limit=200 — irregularidades detectadas */
  @Get("fraud-check")
  fraudCheck(@Query("limit") limit?: string) {
    return this.service.fraudCheck(limit ? parseInt(limit, 10) : 200);
  }

  /** GET /api/e14/comparacion?dept=01&minDiff=3 — E14 vs preconteo por municipio */
  @Get("comparacion")
  comparacion(@Query("dept") dept?: string, @Query("minDiff") minDiff?: string) {
    return this.service.comparacion(dept, minDiff ? parseFloat(minDiff) : 3);
  }

  /** POST /api/e14/claim — reclamar siguiente acta para auditar */
  @Post("claim")
  @UseGuards(JwtAuthGuard)
  claimNextActa(@Request() req: { user: { sub: string; email: string; name?: string } }) {
    return this.service.claimNextActa(req.user.sub, req.user.email, req.user.name ?? "Auditor");
  }

  /** POST /api/e14/submit — enviar resultado de auditoría */
  @Post("submit")
  @UseGuards(JwtAuthGuard)
  submitAudit(
    @Body() body: { txId: string; ocrResult: Record<string, unknown> },
    @Request() req: { user: { sub: string; email: string; name?: string } },
  ) {
    return this.service.submitAudit(body.txId, body.ocrResult, req.user.sub, req.user.email, req.user.name ?? "Auditor");
  }
}
