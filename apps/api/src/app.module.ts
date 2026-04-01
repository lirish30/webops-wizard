import {
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod
} from "@nestjs/common";

import { RequestContextMiddleware } from "./common/audit/request-context.middleware";
import { HealthController } from "./common/health.controller";
import { AlertsModule } from "./domains/alerts/alerts.module";
import { AuditLogModule } from "./domains/audit-log/audit-log.module";
import { AuthModule } from "./domains/auth/auth.module";
import { DataTrustModule } from "./domains/data-trust/data-trust.module";
import { IntegrationsModule } from "./domains/integrations/integrations.module";
import { PageIntelligenceModule } from "./domains/page-intelligence/page-intelligence.module";
import { PropertiesModule } from "./domains/properties/properties.module";
import { RecommendationsModule } from "./domains/recommendations/recommendations.module";
import { ReleasesModule } from "./domains/releases/releases.module";
import { ReportsModule } from "./domains/reports/reports.module";
import { SettingsModule } from "./domains/settings/settings.module";
import { WorkspacesModule } from "./domains/workspaces/workspaces.module";

@Module({
  controllers: [HealthController],
  imports: [
    AuthModule,
    WorkspacesModule,
    PropertiesModule,
    IntegrationsModule,
    PageIntelligenceModule,
    DataTrustModule,
    RecommendationsModule,
    ReportsModule,
    AlertsModule,
    ReleasesModule,
    SettingsModule,
    AuditLogModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
