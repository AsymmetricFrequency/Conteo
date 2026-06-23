import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PreconteoController } from "./preconteo.controller";
import { PreconteoService } from "./preconteo.service";

@Module({
  imports: [PrismaModule],
  controllers: [PreconteoController],
  providers: [PreconteoService],
  exports: [PreconteoService],
})
export class PreconteoModule {}
