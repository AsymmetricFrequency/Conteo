import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { UpdateEstadoSchema, type UpdateEstadoDto } from "./alerts.dto";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(
    @Query("severity") severity?: string,
    @Query("category") category?: string,
    @Query("estado") estado?: string,
    @Query("municipio") municipio?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.alerts.list({
      severity,
      category,
      estado,
      municipio,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Patch(":id")
  updateEstado(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateEstadoSchema)) body: UpdateEstadoDto,
  ) {
    return this.alerts.updateEstado(id, body);
  }
}
