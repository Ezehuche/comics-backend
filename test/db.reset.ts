import { PrismaService } from 'src/services/prisma.service';

export async function clearDatabase(prisma: PrismaService) {
  // const allowedTables = ['fxqlDb']; // List of allowed tables

  // console.log(process.env.DB_TABLE_NAME);

  const tableName = process.env.DB_TABLE_NAME;

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
}
