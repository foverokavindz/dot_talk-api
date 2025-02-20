const sgMail = require('@sendgrid/mail');

const dotenv = require('dotenv');
dotenv.config({
  path: '../config.env',
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendSGMail = async ({
  recipient,
  sender,
  subject,
  html,
  attachments,
  text,
}) => {
  try {
    const from = sender || 'kavindamadhuranga74@gmail.com';

    const msg = {
      to: recipient,
      from: from,
      subject: subject,
      html: html,
      text: text,
      attachments,
    };

    return sgMail.send(msg);
  } catch (error) {
    console.log(error);
  }
};

exports.sendEmail = async (args) => {
  if (!process.env.NODE_ENV === 'development') {
    return Promise.resolve();
  } else {
    return sendSGMail(args);
  }
};
