import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication
} from "@nestjs/platform-fastify";

import { AppModule } from "../app.module";
import { createOpenApiDocument } from "../common/api/openapi";

async function generate() {
  process.env.NODE_ENV ??= "development";
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/webops_wizard";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.JWT_SECRET ??= "openapi-docs-secret";

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false }
  );

  app.setGlobalPrefix("api/v1");

  const document = createOpenApiDocument(app);
  const outputPath = resolve(process.cwd(), "openapi/openapi.json");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf-8");

  await app.close();
}

void generate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
