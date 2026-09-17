import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailService } from '../../shared/mail/mail.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  otpMatches,
} from '../../shared/security/otp';
import { hashPassword } from '../../shared/security/password';
import { ForgotPasswordDto, ResetPasswordDto, VerifyOtpDto } from './auth.dto';
import { USER_STATUS } from './user-status';

const INVALID_OTP = 'Mã không đúng hoặc đã hết hạn';
export const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class PasswordResetService {
  // ponytail: đếm số lần nhập sai trong RAM — chỉ đúng khi chạy 1 instance và reset khi restart.
  // Chạy nhiều instance thì cần thêm cột Attempts vào PasswordResetToken (đổi schema, phải cập nhật ERD).
  private readonly failedAttempts = new Map<number, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async forgotPassword({ email }: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Tài khoản bị khoá / đã xoá trả y hệt email không tồn tại.
    if (!user || user.status !== USER_STATUS.ACTIVE) {
      throw new NotFoundException('Email không tồn tại');
    }

    const otp = generateOtp();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.mail.sendOtpEmail(user.email, otp, OTP_TTL_MS / 60_000);
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<void> {
    await this.findValidToken(dto);
  }

  async resetPassword({
    email,
    otp,
    newPassword,
  }: ResetPasswordDto): Promise<void> {
    // Luôn xác thực lại OTP ở BE, không tin rằng FE đã gọi verify-otp.
    const token = await this.findValidToken({ email, otp });
    const password = await hashPassword(newPassword);

    await this.prisma.$transaction(async (tx) => {
      // Điều kiện usedAt: null chặn 2 request đồng thời cùng dùng 1 mã. Chỉ đánh dấu, không xoá row.
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (count !== 1) throw new BadRequestException(INVALID_OTP);
      await tx.user.update({ where: { id: token.userId }, data: { password } });
    });
    this.failedAttempts.delete(token.id);
  }

  /** Chỉ mã mới nhất của user được chấp nhận; mọi lý do thất bại trả cùng 1 message. */
  private async findValidToken({ email, otp }: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== USER_STATUS.ACTIVE)
      throw new BadRequestException(INVALID_OTP);

    const token = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { id: 'desc' },
    });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new BadRequestException(INVALID_OTP);
    }

    const attempts = this.failedAttempts.get(token.id) ?? 0;
    if (attempts >= MAX_OTP_ATTEMPTS)
      throw new BadRequestException(INVALID_OTP);
    if (!otpMatches(otp, token.tokenHash)) {
      this.failedAttempts.set(token.id, attempts + 1);
      throw new BadRequestException(INVALID_OTP);
    }
    return token;
  }
}
