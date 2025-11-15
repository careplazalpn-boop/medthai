import mysql from "mysql2/promise";
import dotenv from "dotenv";
import iconv from "iconv-lite";

dotenv.config({ path: ".env.local" });

// convert tis620 → utf8
const decodeTIS = (val) =>
  val ? iconv.decode(Buffer.from(val, "binary"), "tis620") : "";

async function main() {
  console.log("=== Start Sync patient_image ===");

  const db1 = await mysql.createConnection({
    host: process.env.DB1_HOST,
    user: process.env.DB1_USER,
    password: process.env.DB1_PASSWORD,
    database: process.env.DB1_NAME,
    charset: "TIS620_TH",
  });

  const db3 = await mysql.createConnection({
    host: process.env.DB3_HOST,
    user: process.env.DB3_USER,
    password: process.env.DB3_PASSWORD,
    database: process.env.DB3_NAME,
  });

  const BATCH = 300;
  let synced = 0;

  while (true) {
    const [rows] = await db1.execute(
      `
      SELECT img.*
      FROM patient_image img
      LEFT JOIN DB3_HOST.ptis.patient_image img3
        ON img.hn = img3.hn
        AND img.image_name = img3.image_name
      WHERE img3.hn IS NULL
        AND img.hn != '9999999'
      LIMIT ?
      `,
      [BATCH]
    );

    if (rows.length === 0) break;

    for (const r of rows) {
      // แปลง charset เฉพาะ field text
      r.hn = decodeTIS(r.hn);
      r.image_name = decodeTIS(r.image_name);
      r.hos_guid = decodeTIS(r.hos_guid);
      r.hos_guid_ext = decodeTIS(r.hos_guid_ext);

      await db3.execute(
        `
        INSERT INTO patient_image
        (hn, image_name, image, width, height, capture_date, hos_guid, hos_guid_ext)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          r.hn,
          r.image_name,
          r.image,
          r.width,
          r.height,
          r.capture_date,
          r.hos_guid,
          r.hos_guid_ext,
        ]
      );

      console.log("Synced image:", r.hn, "/", r.image_name);
    }

    synced += rows.length;
    console.log(`Batch synced: ${synced}`);
  }

  console.log("=== patient_image sync completed ===");

  await db1.end();
  await db3.end();
}

main().catch(console.error);
