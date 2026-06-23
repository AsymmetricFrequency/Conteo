import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { FormsModule } from "./forms/forms.module";
import { AlertsModule } from "./alerts/alerts.module";
import { StatsModule } from "./stats/stats.module";
import { PreconteoModule } from "./preconteo/preconteo.module";
import { E14Module } from "./e14/e14.module";
import { AuthModule } from "./auth/auth.module";
import { EncryptionModule } from "./encryption/encryption.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    HealthModule,
    FormsModule,
    AlertsModule,
    StatsModule,
    PreconteoModule,
    E14Module,
    AuthModule,
    EncryptionModule,
  ],
})
export class AppModule {}
