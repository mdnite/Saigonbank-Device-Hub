import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { OTP_LENGTH } from '../../shared/security/otp';

// Đồng bộ với PASSWORD_MIN_LENGTH ở FE (src/modules/auth/domain/credentials.ts).
const PASSWORD_MIN_LENGTH = 6;
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);
const OTP_MESSAGE = `Mã xác thực phải gồm ${OTP_LENGTH} chữ số`;
const EMAIL_MESSAGE = 'Email không hợp lệ';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập hoặc email' })
  identifier!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: EMAIL_MESSAGE })
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail({}, { message: EMAIL_MESSAGE })
  email!: string;

  @IsString()
  @Matches(OTP_PATTERN, { message: OTP_MESSAGE })
  otp!: string;
}

export class ResetPasswordDto extends VerifyOtpDto {
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
  })
  newPassword!: string;
}
