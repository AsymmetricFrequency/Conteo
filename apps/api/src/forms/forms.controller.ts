import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { FormsService } from "./forms.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { E14Schema, type E14 } from "@conteo/domain";

@Controller("forms")
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  /** Ingesta de un E-14 normalizado; corre el motor y persiste el reporte. */
  @Post()
  ingest(@Body(new ZodValidationPipe(E14Schema)) body: E14) {
    return this.forms.ingest(body);
  }

  @Get()
  list(@Query("skip") skip?: string, @Query("take") take?: string) {
    return this.forms.list(
      skip ? Number(skip) : 0,
      take ? Number(take) : 50,
    );
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.forms.detail(id);
  }
}
