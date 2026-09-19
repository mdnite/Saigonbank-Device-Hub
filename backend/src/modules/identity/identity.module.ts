import { Module } from '@nestjs/common';
import { MailService } from '../../shared/mail/mail.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordResetService, MailService],
})
export class IdentityModule {}
