import { ROLE } from '../../modules/identity/roles';
import { ACTOR } from './actors';

const matched = (roleName: string, departmentCode: string | null) =>
  Object.entries(ACTOR)
    .filter(([, is]) => is({ id: 1, roleName, departmentCode }))
    .map(([name]) => name);

describe('ACTOR', () => {
  it.each([
    [ROLE.ADMIN, null, ['ADMIN']],
    [ROLE.ADMIN, 'KYTHUAT', ['ADMIN']],
    [ROLE.HEAD, 'KYTHUAT', ['TECH_HEAD']],
    [ROLE.SPECIALIST, 'KYTHUAT', ['TECH_SPECIALIST']],
    [ROLE.HEAD, 'KETOAN', ['ACCT_HEAD']],
    [ROLE.SPECIALIST, 'KETOAN', ['ACCT_SPECIALIST']],
    // Không khớp actor nào: không phòng ban (dữ liệu cũ), Nhân viên.
    [ROLE.HEAD, null, []],
    [ROLE.SPECIALIST, null, []],
    [ROLE.STAFF, 'KYTHUAT', []],
    ['Role lạ', 'KYTHUAT', []],
  ])('%s + %s → %j', (roleName, departmentCode, expected) => {
    expect(matched(roleName, departmentCode)).toEqual(expected);
  });
});
