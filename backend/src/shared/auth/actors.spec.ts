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
    [ROLE.COLLAB, 'KYTHUAT', ['TECH_COLLAB']],
    // Không khớp actor nào: Kế toán, không phòng ban (dữ liệu cũ), Nhân viên.
    [ROLE.HEAD, 'KETOAN', []],
    [ROLE.COLLAB, 'KETOAN', []],
    [ROLE.HEAD, null, []],
    [ROLE.COLLAB, null, []],
    [ROLE.STAFF, 'KYTHUAT', []],
    ['Role lạ', 'KYTHUAT', []],
  ])('%s + %s → %j', (roleName, departmentCode, expected) => {
    expect(matched(roleName, departmentCode)).toEqual(expected);
  });
});
