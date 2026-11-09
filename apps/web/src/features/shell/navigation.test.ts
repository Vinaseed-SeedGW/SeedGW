import { describe, expect, it } from 'vitest';
import { ROUTE_RULES, isActionPath, permissionForPath } from '@dms/contracts/access';
import { DEPARTMENT_NAV } from './navigation';

const NAV_HREFS = Object.values(DEPARTMENT_NAV).flatMap((groups) =>
  groups.flatMap((group) => group.items.map((item) => item.href)),
);

describe('menu va quy tac quyen', () => {
  it('moi muc menu deu co quy tac quyen', () => {
    for (const href of NAV_HREFS) expect(permissionForPath(href), href).not.toBeNull();
  });

  it('moi trang trong bo phan deu co tren menu, tru trang tao moi', () => {
    const pages = ROUTE_RULES.filter(
      (rule) => rule.department !== null && !isActionPath(rule.path),
    ).map((rule) => rule.path);
    expect([...NAV_HREFS].sort()).toEqual([...pages].sort());
  });
});
