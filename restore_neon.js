const fs = require('fs');
const { Pool } = require('pg');

const NEON_URL = 'postgresql://neondb_owner:npg_PVSIHk7zYvy1@ep-sweet-voice-azm3jbv0-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to Neon DB...');
  const client = await pool.connect();
  try {
    console.log('Connected! Creating schema...');

    // 1. Create Sequences and Tables if not exist
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS "Admin_id_seq" AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
      CREATE SEQUENCE IF NOT EXISTS "User_id_seq" AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

      CREATE TABLE IF NOT EXISTS "public"."Admin" (
          "id" integer DEFAULT nextval('"Admin_id_seq"') NOT NULL,
          "username" text NOT NULL,
          "password" text NOT NULL,
          "stkDoanhNghiep" text NOT NULL,
          "nganHangChung" text NOT NULL,
          "tenChuDoanhNghiep" text NOT NULL,
          "linkQrCode" text NOT NULL,
          CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
      );

      CREATE TABLE IF NOT EXISTS "public"."User" (
          "id" integer DEFAULT nextval('"User_id_seq"') NOT NULL,
          "name" text NOT NULL,
          "phone" text NOT NULL,
          "cccd" text NOT NULL,
          "hanThanhToan" text NOT NULL,
          "tienCanThanhToan" text NOT NULL,
          "tienGiaiNgan" text NOT NULL,
          "ngayGiaiNgan" text,
          "soTaiKhoan" text,
          "nganHang" text,
          "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT "User_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "Admin_username_key" ON "public"."Admin" ("username");
      CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "public"."User" ("phone");
    `);
    console.log('Tables and indexes verified/created.');

    // 2. Parse and Insert Admin from 3393.dat
    console.log('\n--- Parsing 3393.dat (Admin) ---');
    const adminContent = fs.readFileSync('3393.dat', 'utf8');
    const adminLines = adminContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    console.log(`Found ${adminLines.length} lines in 3393.dat`);

    for (const line of adminLines) {
      if (line.startsWith('\\.')) continue;
      const parts = line.split('\t');
      if (parts.length >= 7) {
        const [id, username, password, stkDoanhNghiep, nganHangChung, tenChuDoanhNghiep, linkQrCode] = parts.map(p => p === '\\N' ? null : p);
        console.log(`Upserting Admin: id=${id}, username=${username}`);
        await client.query(`
          INSERT INTO "public"."Admin" ("id", "username", "password", "stkDoanhNghiep", "nganHangChung", "tenChuDoanhNghiep", "linkQrCode")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT ("username") DO UPDATE SET
            "id" = EXCLUDED."id",
            "password" = EXCLUDED."password",
            "stkDoanhNghiep" = EXCLUDED."stkDoanhNghiep",
            "nganHangChung" = EXCLUDED."nganHangChung",
            "tenChuDoanhNghiep" = EXCLUDED."tenChuDoanhNghiep",
            "linkQrCode" = EXCLUDED."linkQrCode"
        `, [parseInt(id), username, password, stkDoanhNghiep, nganHangChung, tenChuDoanhNghiep, linkQrCode]);
      }
    }

    // 3. Parse and Insert User from 3391.dat
    console.log('\n--- Parsing 3391.dat (User) ---');
    const userContent = fs.readFileSync('3391.dat', 'utf8');
    const userLines = userContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    console.log(`Found ${userLines.length} lines in 3391.dat`);

    let userCount = 0;
    let maxUserId = 0;

    for (const line of userLines) {
      if (line.startsWith('\\.')) continue;
      const parts = line.split('\t');
      if (parts.length >= 11) {
        const [id, name, phone, cccd, hanThanhToan, tienCanThanhToan, tienGiaiNgan, ngayGiaiNgan, soTaiKhoan, nganHang, createdAt] = parts.map(p => p === '\\N' ? null : p);
        const parsedId = parseInt(id);
        if (parsedId > maxUserId) maxUserId = parsedId;

        await client.query(`
          INSERT INTO "public"."User" ("id", "name", "phone", "cccd", "hanThanhToan", "tienCanThanhToan", "tienGiaiNgan", "ngayGiaiNgan", "soTaiKhoan", "nganHang", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT ("phone") DO UPDATE SET
            "name" = EXCLUDED."name",
            "cccd" = EXCLUDED."cccd",
            "hanThanhToan" = EXCLUDED."hanThanhToan",
            "tienCanThanhToan" = EXCLUDED."tienCanThanhToan",
            "tienGiaiNgan" = EXCLUDED."tienGiaiNgan",
            "ngayGiaiNgan" = EXCLUDED."ngayGiaiNgan",
            "soTaiKhoan" = EXCLUDED."soTaiKhoan",
            "nganHang" = EXCLUDED."nganHang",
            "createdAt" = EXCLUDED."createdAt"
        `, [parsedId, name, phone, cccd, hanThanhToan, tienCanThanhToan, tienGiaiNgan, ngayGiaiNgan, soTaiKhoan, nganHang, createdAt ? new Date(createdAt) : new Date()]);
        userCount++;
      }
    }
    console.log(`Successfully imported/updated ${userCount} users.`);

    // 4. Update sequences
    const maxAdminRes = await client.query('SELECT COALESCE(MAX("id"), 1) as max_id FROM "public"."Admin"');
    const adminSeqVal = Math.max(Number(maxAdminRes.rows[0].max_id), 1);
    await client.query(`SELECT pg_catalog.setval('"public"."Admin_id_seq"', $1, true)`, [adminSeqVal]);
    console.log(`Admin_id_seq set to ${adminSeqVal}`);

    const maxUserRes = await client.query('SELECT COALESCE(MAX("id"), 1) as max_id FROM "public"."User"');
    const userSeqVal = Math.max(Number(maxUserRes.rows[0].max_id), maxUserId, 912);
    await client.query(`SELECT pg_catalog.setval('"public"."User_id_seq"', $1, true)`, [userSeqVal]);
    console.log(`User_id_seq set to ${userSeqVal}`);

    // 5. Verify data
    const adminCheck = await client.query('SELECT "id", "username", "password", "tenChuDoanhNghiep", "stkDoanhNghiep", "nganHangChung" FROM "public"."Admin"');
    console.log('\n--- Current Admins in Neon DB ---');
    console.table(adminCheck.rows);

    const userCountCheck = await client.query('SELECT COUNT(*) as count FROM "public"."User"');
    console.log('\nTotal Users in Neon DB:', userCountCheck.rows[0].count);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
