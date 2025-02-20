const jwt = require('jsonwebtoken');
const User = require('../models/user');
const filterObjects = require('../utils/filterObjects');
const otpGenerator = require('otp-generator');
const crypto = require('crypto');
const { sendEmail } = require('../services/mailer');

// sign JWT token
const signToken = (userId) => {
  jwt.sign({ userId }, process.env.JWT_SEC);
};

exports.register = async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;
  const existingUser = await User.findOne({ email: email });

  const filteredBody = filterObjects(
    req.body,
    'firstName',
    'lastName',
    'email',
    'password'
  );

  if (existingUser && existingUser.varified) {
    res.status(400).json({
      status: 'error',
      message: 'This email already in use',
    });
    return;
  } else if (existingUser) {
    await User.findOneAndUpdate({ email: email }, filteredBody, {
      new: true,
      validateModifiledOnly: true,
    });

    req.userId = existingUser._id;
    next();
  } else {
    // if user is not found, create a new user
    const newUser = await User.create(filteredBody);

    // generate OTP

    req.userId = newUser._id;

    next();
  }
};

exports.sendOTP = async (req, res, next) => {
  const { userId } = req;

  const new_OTP = otpGenerator.generate(6, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });

  const otp_expiry_time = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await User.findByIdAndUpdate(userId, {
    otp: new_OTP,
    otp_expiry_time,
  });

  // TODO send email

  sendEmail({
    recipient: 'kavindamadhuranga74.2@gmail.com',
    sender: 'kavindamadhuranga74@gmail.com',
    subject: 'OTP for email verification',
    text: 'Your OTP is ' + new_OTP + '. This OTP is valid for 10 minutes',
  });

  res.status(200).json({
    status: 'success',
    message: 'OTP sent successfully',
  });
};

exports.verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  const userDoc = await User.findOne({
    email: email,
    otp_expiry_time: { $gt: Date.now() },
  });

  if (!userDoc) {
    res.status(400).json({
      status: 'error',
      message: 'OTP is invalid or expired',
    });

    return;
  }

  if (!(await userDoc.correctOTP(otp, userDoc.otp))) {
    res.status(400).json({
      status: 'error',
      message: 'Incorrect OTP',
    });

    return;
  }

  //OTP is correct

  userDoc.verified = true;
  userDoc.otp = undefined;

  await userDoc.save({ new: true, validateModifiedOnly: true });

  // otp is variified and kicked into the application
  const token = signToken(userDoc._id);

  res.status(200).json({
    status: 'success',
    message: 'OTP verified successfully',
    token,
  });
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      status: 'error',
      message: 'Both email and password are required',
    });
    return;
  }

  const userDoc = await User.findOne({ email: email }).select('+password');

  if (
    !userDoc ||
    !(await userDoc.correctPassword(password, userDoc.password))
  ) {
    res.status(400).json({
      status: 'error',
      message: 'Incorrect email or password',
    });

    return;
  }

  const token = signToken(userDoc._id);

  res.status(200).json({
    status: 'success',
    message: 'Logged in successfully',
    token,
  });
};

exports.protect = async (req, res, next) => {
  //1. getting the token

  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  } else {
    res.status(401).json({
      status: 'error',
      message: 'You are not logged in. Please log in to get access',
    });

    return;
  }

  //2. verify the token

  const decodeUser = jwt.decode(token, process.env.JWT_SEC);

  // check user still exixts
  const thisUser = await User.findById(decodeUser.userId);

  if (!thisUser) {
    res.status(401).json({
      status: 'error',
      message: 'The user belonging to this token does not exist',
    });

    return;
  }

  // check if user changed password after the token was issued

  if (thisUser.changedPasswordAfter(decodeUser.iat)) {
    res.status(400).json({
      status: 'error',
      message: 'User recently updated the password! Please sign in again',
    });
  }

  req.user = thisUser;

  next();
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  const userDoc = await User.findOne({ email: email });

  if (!userDoc) {
    res.status(400).json({
      status: 'error',
      message: 'There is no user with this email',
    });

    return;
  }

  //generate the ramdom token
  // ?code=skfjskj243234

  const resetToken = user.createPasswordResetToken();
  await userDoc.save({ validateModifiedOnly: true });

  const resetUrl = `http://localhost:3000/auth/reset-password/${resetToken}`;

  try {
    // send email

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (error) {
    userDoc.passwordResetToken = undefined;
    userDoc.passwordResetExpires = undefined;

    // we are setting the validateBeforeSave to false because we are not validating and we are setting undefined values
    await userDoc.save({ validateBeforeSave: false });

    res.status(500).json({
      status: 'error',
      message: 'There was an error sending the email. Try again later',
    });
  }
};

exports.resetPassword = async (req, res, next) => {
  // get user based on the token
  const { token: resetToken } = req.params;
  const { password, confirmPassword } = req.body;

  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  const userDoc = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  //2. if token is invalid or expired
  if (!userDoc) {
    res.status(400).json({
      status: 'error',
      message: 'Token is invalid or expired',
    });

    return;
  }

  // 3. update users password and set resetToke, and expire to undefined

  userDoc.password = password;
  userDoc.confirmPassword = confirmPassword;
  userDoc.passwordResetToken = undefined;
  userDoc.passwordResetExpires = undefined;

  await userDoc.save();

  // 4. log the user in, send JWT

  // send email to user informing about password reset

  const token = signToken(userDoc._id);

  res.status(200).json({
    status: 'sucess',
    message: 'Password reseted succesfully',
    token,
  });
};
