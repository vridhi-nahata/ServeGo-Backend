import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';

// Log SMTP configuration to verify environment variables
// console.log("SMTP_HOST:", process.env.SMTP_HOST);
// console.log("SMTP_USER:", process.env.SMTP_USER ? "Defined" : "Undefined");
// console.log("SMTP_PASS:", process.env.SMTP_PASS ? "Defined" : "Undefined");

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