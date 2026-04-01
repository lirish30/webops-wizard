import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { AlertsController } from "./alerts.controller";

@Module({
  imports: [SecurityModule],
  controllers: [AlertsController]
})
export class AlertsModule {}
