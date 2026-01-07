import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "../lib/auth";

// Ensure DATABASE_URL is loaded
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL not found. Seed cannot run.");
}

// Prisma 7: Requires explicit adapter configuration
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create users
  const adminPassword = await hashPassword("admin123");
  const leadGenPassword = await hashPassword("leadgen123");
  const outreachPassword = await hashPassword("outreach123");

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPassword,
      role: "admin",
    },
  });

  const leadGen = await prisma.user.upsert({
    where: { username: "leadgen" },
    update: {},
    create: {
      username: "leadgen",
      password: leadGenPassword,
      role: "lead_gen",
    },
  });

  const outreach = await prisma.user.upsert({
    where: { username: "outreach" },
    update: {},
    create: {
      username: "outreach",
      password: outreachPassword,
      role: "outreach",
    },
  });

  console.log("✅ Users created:");
  console.log(`  - Admin: ${admin.username} (${admin.id})`);
  console.log(`  - Lead Gen: ${leadGen.username} (${leadGen.id})`);
  console.log(`  - Outreach: ${outreach.username} (${outreach.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
