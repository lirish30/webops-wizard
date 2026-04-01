import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { ReleasesController } from "./releases.controller";

@Module({
  imports: [SecurityModule],
  controllers: [ReleasesController]
})
export class ReleasesModule {}
