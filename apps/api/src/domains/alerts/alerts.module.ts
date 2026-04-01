import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";

@Module({
  imports: [SecurityModule],
  controllers: [AlertsController],
  providers: [AlertsService]
})
export class AlertsModule {}
