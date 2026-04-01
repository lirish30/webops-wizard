import "@webops-wizard/db";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { getApiEnv } from "./config/env";

async function bootstrap() {
  const env = getApiEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
}

void bootstrap();
