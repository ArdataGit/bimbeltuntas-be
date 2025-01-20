const nodemailer = require('nodemailer');
const mustache = require('mustache');
const fs = require('fs');
require('dotenv').config();

const sendMail = async (data) => {
  try {
    const { to, subject, template } = data;

    const fileTemplate = fs.readFileSync(
      `src/utils/email/templates/${template}`,
      'utf8'
    );

    const transporter = nodemailer.createTransport({
      service: process.env.SMTP_SERVICE,
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"${process.env.SMTP_EMAIL}" <${process.env.SMTP_EMAIL}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      html: mustache.render(fileTemplate, { ...data }),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[+] BERHASIL MENGIRIM EMAIL [+]');
    return true;
  } catch (error) {
    console.error('[-] GAGAL MENGIRIM EMAIL [-]', error);
    return false;
    // throw error; // Rethrow the error to be handled by the caller
  }
};

module.exports = sendMail;
