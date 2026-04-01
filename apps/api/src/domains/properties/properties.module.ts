import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { PropertiesController } from "./properties.controller";

@Module({
  imports: [SecurityModule],
  controllers: [PropertiesController]
})
export class PropertiesModule {}
