import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaModule } from "../prisma/prisma.module";
import { EncryptionService } from "../encryption/encryption.service";

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "conteo-secret-2026-colombia",
      signOptions: { expiresIn: "30d" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EncryptionService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
