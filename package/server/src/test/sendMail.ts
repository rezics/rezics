import 'dotenv/config';

import {env} from '../env';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST as string,
  port: 465,
  secure: true,
  auth: {
    user: env.SMTP_USER as string,
    pass: env.SMTP_PASSWORD as string,
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
  from: `${env.SMTP_USER_NAME} <${env.SMTP_USER}>`,
  to: 'edgecoordinates@gmail.com',
  subject: 'Test Email',
  text: 'This is a test email',
  html: '<p>This is a test email</p>',
});

console.log(result);
