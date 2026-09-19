import { Module } from '@nestjs/common';
import { LookupController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, LookupController],
  providers: [UsersService],
})
export class UsersModule {}
