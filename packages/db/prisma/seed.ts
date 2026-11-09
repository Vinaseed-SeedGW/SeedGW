import { hash } from 'argon2';
import { PrismaClient } from '@prisma/client';

const SEED_ROLES = [
  { code: 'admin', name: 'Quản trị hệ thống' },
  { code: 'sales', name: 'Kinh doanh' },
  { code: 'customer-care', name: 'Chăm sóc khách hàng' },
  { code: 'operations', name: 'Quản trị' },
];

const SEED_USERS = [
  { employeeCode: 'ADMIN', fullName: 'Quản trị viên', roleCode: 'admin' },
  { employeeCode: 'KD001', fullName: 'Nhân viên Kinh doanh', roleCode: 'sales' },
  { employeeCode: 'CS001', fullName: 'Nhân viên CSKH', roleCode: 'customer-care' },
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

    for (const role of SEED_ROLES) {
      await db.role.upsert({ where: { code: role.code }, update: {}, create: role });
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

    console.log(`Da nap ${SEED_USERS.length} tai khoan mau.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
