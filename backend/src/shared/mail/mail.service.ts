import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = config.getOrThrow<string>('RESEND_FROM_EMAIL');
  }

  async sendOtpEmail(
    to: string,
    otp: string,
    ttlMinutes: number,
  ): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'IDMS - Mã xác thực đặt lại mật khẩu',
      text: `Mã xác thực của bạn là ${otp}. Mã có hiệu lực trong ${ttlMinutes} phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
    });
    // Resend trả lỗi trong `error` chứ không throw.
    if (error) {
      this.logger.error(`Gửi OTP tới ${to} thất bại: ${error.message}`);
      throw new InternalServerErrorException(
        'Không gửi được email, vui lòng thử lại sau',
      );
    }
  }
}
