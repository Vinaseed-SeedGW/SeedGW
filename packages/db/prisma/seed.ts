import { hash } from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_PRESETS } from '@dms/contracts/access';

const SEED_USERS = [
  { employeeCode: 'ADMIN', fullName: 'Quản trị viên', roleCode: 'admin' },
  { employeeCode: 'KD001', fullName: 'Nhân viên Kinh doanh', roleCode: 'staff' },
  { employeeCode: 'CS001', fullName: 'Nhân viên CSKH', roleCode: 'staff' },
  { employeeCode: 'QT001', fullName: 'Nhân viên Quản trị', roleCode: 'operations' },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Khong nap du lieu mau tren moi truong production.');
  }
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error('Thieu SEED_PASSWORD trong file .env.');
  }

  const db = new PrismaClient();
  try {
    const passwordHash = await hash(password);
    const company = await db.orgUnit.upsert({
      where: { code: 'VINASEED' },
      update: {},
      create: { code: 'VINASEED', name: 'Vinaseed' },
    });

    for (const permission of PERMISSIONS) {
      await db.permission.upsert({
        where: { code: permission.code },
        update: { name: permission.name },
        create: permission,
      });
    }

    for (const preset of ROLE_PRESETS) {
      const permissions = preset.permissions.map((code) => ({ code }));
      await db.role.upsert({
        where: { code: preset.code },
        update: {
          name: preset.name,
          dataScope: preset.dataScope,
          permissions: { set: permissions },
        },
        create: {
          code: preset.code,
          name: preset.name,
          dataScope: preset.dataScope,
          permissions: { connect: permissions },
        },
      });
    }

    for (const { roleCode, ...user } of SEED_USERS) {
      const saved = await db.user.upsert({
        where: { employeeCode: user.employeeCode },
        update: { passwordHash },
        create: { ...user, passwordHash, orgUnitId: company.id },
      });
      const role = await db.role.findUniqueOrThrow({ where: { code: roleCode } });
      await db.userRole.upsert({
        where: { userId_roleId: { userId: saved.id, roleId: role.id } },
        update: {},
        create: { userId: saved.id, roleId: role.id },
      });
    }

    console.log(
      `Da nap ${PERMISSIONS.length} quyen, ${ROLE_PRESETS.length} vai tro, ${SEED_USERS.length} tai khoan mau.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
