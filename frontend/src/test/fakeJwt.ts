/** JWT giả (không ký) chỉ để test phần FE đọc `exp`. */
export function fakeJwt(exp: number): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ userId: 1, roleId: 1, exp })}.sig`;
}

export const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;
