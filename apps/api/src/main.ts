import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix("api");

  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3001;
  await app.listen(port);
  new Logger("Bootstrap").log(`API en http://localhost:${port}/api`);
}

void bootstrap();
