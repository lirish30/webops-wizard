import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { ReleasesController } from "./releases.controller";
import { ReleasesService } from "./releases.service";

@Module({
  imports: [SecurityModule],
  controllers: [ReleasesController],
  providers: [ReleasesService]
})
export class ReleasesModule {}
