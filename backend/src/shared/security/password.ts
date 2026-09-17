import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

export const hashPassword = (plain: string) =>
  bcrypt.hash(plain, BCRYPT_ROUNDS);

export const comparePassword = (plain: string, hash: string) =>
  bcrypt.compare(plain, hash);
