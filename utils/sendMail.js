const nodeMailer = require('nodemailer');

const sendMail = async ({ to, subject, html }) => {
  try {
    const transporter = nodeMailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.log(`[ERROR] SEND MAIL: ${error.message}`);
    return {};
  }
};
module.exports = {
  sendMail
};
