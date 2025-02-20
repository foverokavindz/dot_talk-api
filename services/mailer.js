const sgMail = require('@sendgrid/mail');

//sgMail.setApiKey(process.env.SG_KEY);
sgMail.setApiKey(
  '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'
);

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

    const response = await sgMail.send(msg);
    return response;
  } catch (error) {
    console.error('Email sending failed:', error);
    // Throw a cleaner error object
    throw new Error(
      error.response?.body?.errors?.[0]?.message || 'Failed to send email'
    );
  }
};

exports.sendEmail = async (args) => {
  if (!args.recipient) {
    throw new Error('Recipient email is required');
  }
  return sendSGMail(args);
};
