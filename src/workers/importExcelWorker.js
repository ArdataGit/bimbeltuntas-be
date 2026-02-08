const { Worker } = require("bullmq");
const fs = require("fs");
const path = require("path");
const os = require("os");
const readXlsxFile = require("read-excel-file/node").default;
const database = require("#database");
const { sendMail, generateUniqueINV } = require("#utils");
const moment = require("moment");
const bcrypt = require("bcryptjs");

const worker = new Worker(
  "importExcel",
  async (job) => {
    const { filePath } = job.data;

    const rows = await readXlsxFile(fs.createReadStream(filePath));
    rows.shift();

    let processed = 0;
    let failed = 0;

    const logDir = path.join(__dirname, "../../logs/import");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const logFile = path.join(
      logDir,
      `import-${Date.now()}.log`
    );

    fs.writeFileSync(logFile, `=== START ${new Date()} ===${os.EOL}`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row[0]);
      const password = String(row[1]);
      const paketArray = String(row?.[2] || "")
        .split("|")
        .map(v => Number(v))
        .filter(v => !Number.isNaN(v));

      try {
        await database.$transaction(async (tx) => {
          const existing = await tx.User.findUnique({
            where: { email },
            select: { id: true }
          });

          let userId;

          if (existing) {
            await tx.User.update({
              where: { id: existing.id },
              data: {
                password: bcrypt.hashSync(password, 10)
              }
            });

            userId = existing.id;

            await tx.Pembelian.deleteMany({
              where: { userId }
            });

          } else {
            const newUser = await tx.User.create({
              data: {
                email,
                password: bcrypt.hashSync(password, 10)
              },
              select: { id: true }
            });

            userId = newUser.id;
          }

          for (const pid of paketArray) {
            const paket = await tx.paketPembelian.findUnique({
              where: { id: pid }
            });

            if (!paket) continue;

            const expiredAt = paket.durasi
              ? moment().add(paket.durasi * 31, "days").toDate()
              : null;

            await tx.Pembelian.create({
              data: {
                user: { connect: { id: userId } },
                paketPembelian: { connect: { id: pid } },
                status: "PAID",
                duration: paket.durasi,
                expiredAt,
                namaPaket: paket.nama,
                amount: 0,
                invoice: generateUniqueINV(),
                paymentMethod: "IMPORT",
                paidAt: new Date()
              }
            });
          }
        });

        // Optional: pindahkan ke akhir agar lebih cepat
        
        //sendMail({
         // to: email,
         // subject: "Selamat Datang di Tuntas CBT UKAI",
         // template: "welcome.html",
          //name: email,
         // url: process.env.URL_CLIENT,
         // email,
         // password,
       // });

        processed++;
        fs.appendFileSync(logFile, `[OK] Row ${i + 1} - ${email}${os.EOL}`);

      } catch (err) {
        failed++;
        fs.appendFileSync(
          logFile,
          `[FAILED] Row ${i + 1} - ${email} - ${err.message}${os.EOL}`
        );
      }

      await new Promise((r) => setImmediate(r));
    }

    fs.appendFileSync(
      logFile,
      `=== FINISH ${new Date()} | SUCCESS: ${processed}, FAILED: ${failed} ===${os.EOL}`
    );

    return {
      total: rows.length,
      processed,
      failed,
      logFile
    };
  },
  {
    connection: {
      host: "127.0.0.1",
      port: 6379
    },
    concurrency: 1
  }
);

console.log("Worker Import Excel running...");
