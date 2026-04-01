import { Module } from "@nestjs/common";

import { SecurityModule } from "../../common/security/security.module";
import { BackgroundJobsController } from "./background-jobs.controller";
import { BackgroundJobsService } from "./background-jobs.service";

@Module({
  imports: [SecurityModule],
  controllers: [BackgroundJobsController],
  providers: [BackgroundJobsService],
  exports: [BackgroundJobsService]
})
export class BackgroundJobsModule {}
