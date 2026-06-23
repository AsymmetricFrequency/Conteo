import { Module } from "@nestjs/common";
import { E14Controller } from "./e14.controller";
import { E14Service } from "./e14.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EncryptionService } from "../encryption/encryption.service";

@Module({
  imports: [PrismaModule],
  controllers: [E14Controller],
  providers: [E14Service, EncryptionService],
})
export class E14Module {}
