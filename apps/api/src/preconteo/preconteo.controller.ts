import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  IngestMunicipioSchema,
  PreconteoQuerySchema,
  type IngestMunicipioDto,
  type PreconteoQuery,
} from "./preconteo.dto";
import { PreconteoService } from "./preconteo.service";

@Controller("preconteo")
export class PreconteoController {
  constructor(private readonly service: PreconteoService) {}

  /** POST /api/preconteo — ingestar un municipio del crawler. */
  @Post()
  @UsePipes(new ZodValidationPipe(IngestMunicipioSchema))
  async ingest(@Body() dto: IngestMunicipioDto) {
    return this.service.ingest(dto);
  }

  /** GET /api/preconteo/summary?dept=01 — resumen nacional o por departamento. */
  @Get("summary")
  async summary(@Query("dept") dept?: string) {
    return this.service.summary(dept);
  }

  /** GET /api/preconteo/by-dept — resultados agregados por departamento para el mapa. */
  @Get("by-dept")
  async byDept() {
    return this.service.byDept();
  }

  /** GET /api/preconteo?dept=01&mun=01001&cedula=79262397 — resultados por municipio. */
  @Get()
  async list(@Query() query: PreconteoQuery) {
    const parsed = PreconteoQuerySchema.parse(query);
    return this.service.listResultados(parsed);
  }
}
