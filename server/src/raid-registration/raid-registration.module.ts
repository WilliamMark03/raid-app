import { Module } from '@nestjs/common'
import { RaidRegistrationController } from './raid-registration.controller'
import { RaidRegistrationService } from './raid-registration.service'

@Module({
  controllers: [RaidRegistrationController],
  providers: [RaidRegistrationService],
})
export class RaidRegistrationModule {}
