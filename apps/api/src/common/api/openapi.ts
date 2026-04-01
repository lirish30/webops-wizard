import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { COOKIE_AUTH_SCHEME } from "./openapi-schemas";

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("WebOps Wizard API")
    .setDescription(
      "REST API for WebOps Wizard. All responses are wrapped in success/error envelopes under /api/v1."
    )
    .setVersion("1.0.0")
    .addServer("/api/v1")
    .addCookieAuth("wow_access", {
      type: "apiKey",
      in: "cookie",
      name: "wow_access",
      description: "Session access token cookie"
    }, COOKIE_AUTH_SCHEME)
    .build();

  return SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true
  });
}

export function setupOpenApi(app: INestApplication) {
  const document = createOpenApiDocument(app);

  SwaggerModule.setup("api/v1/docs", app, document, {
    jsonDocumentUrl: "/api/v1/openapi.json",
    yamlDocumentUrl: "/api/v1/openapi.yaml",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true
    }
  });

  return document;
}
