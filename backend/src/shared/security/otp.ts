import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export const OTP_LENGTH = 4;
export const OTP_TTL_MS = 5 * 60 * 1000;

export const generateOtp = () =>
  randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');

// SHA-256 thay vì bcrypt: OTP sống 5 phút, chống dò mã nằm ở giới hạn số lần thử chứ không ở độ chậm của hash.
export const hashOtp = (otp: string) =>
  createHash('sha256').update(otp).digest('hex');

export function otpMatches(otp: string, tokenHash: string): boolean {
  const a = Buffer.from(hashOtp(otp));
  const b = Buffer.from(tokenHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
