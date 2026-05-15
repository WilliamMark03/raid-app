import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { RaidRegistrationModule } from '@/raid-registration/raid-registration.module';

@Module({
  imports: [RaidRegistrationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
