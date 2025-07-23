import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';

const transporter=nodemailer.createTransport({
   host: process.env.SMTP_HOST, 
   port: 587,
   secure: false, // true for 465, false for other ports
   auth:{
      user: process.env.SMTP_USER, 
      pass: process.env.SMTP_PASS   
   },
});

export default transporter;