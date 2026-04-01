import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { DataTrustController } from "./data-trust.controller";
import { DataTrustService } from "./data-trust.service";

@Module({
  imports: [SecurityModule],
  controllers: [DataTrustController],
  providers: [DataTrustService]
})
export class DataTrustModule {}
