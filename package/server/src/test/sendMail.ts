import 'dotenv/config';

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  tls: {
    rejectUnauthorized: true,
  },
});

console.log('Sending email...');

const result = await transporter.sendMail({
  from: `${process.env.SMTP_USER_NAME} <${process.env.SMTP_USER}>`,
  to: 'edgecoordinates@gmail.com',
  subject: 'Test Email',
  text: 'This is a test email',
  html: '<p>This is a test email</p>',
});

console.log(result);
