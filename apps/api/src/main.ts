import "@webops-wizard/db";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api/api-exception.filter";
import { setupOpenApi } from "./common/api/openapi";
import { ApiResponseInterceptor } from "./common/api/api-response.interceptor";
import { getApiEnv } from "./config/env";

async function bootstrap() {
  const env = getApiEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  app.enableCors({
    origin: env.APP_URL,
    credentials: true
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  setupOpenApi(app);

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
}

void bootstrap();
