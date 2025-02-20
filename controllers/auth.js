const jwt = require('jsonwebtoken');
const User = require('../models/user');
const filterObjects = require('../utils/filterObjects');
const otpGenerator = require('otp-generator');
const crypto = require('crypto');
const { sendEmail } = require('../services/mailer');

// sign JWT token
const signToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SEC);
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
    // if user is already in the database and verified, update the user
    res.status(400).json({
      status: 'error',
      message: 'This email already in use',
    });
    return;
  } else if (existingUser) {
    // if user is already in the database not verified, update the user
    await User.findOneAndUpdate({ email: email }, filteredBody, {
      new: true,
      validateModifiledOnly: true,
    });

    req.userId = existingUser._id;
    next();
  } else {
    // if user is not found, create a new user
    const newUser = await User.create(filteredBody);

    req.userId = newUser._id;

    // generate OTP
    next();
  }
};

// this will be called after the register function
exports.sendOTP = async (req, res, next) => {
  const { userId } = req;

  try {
    const new_OTP = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    // Find the user first
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Set the OTP and expiry time
    user.otp = new_OTP;
    user.otp_expiry_time = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save the user to trigger the pre-save middleware
    await user.save({ validateModifiedOnly: true });

    // Then try to send the email
    try {
      await sendEmail({
        recipient: req.body.email,
        sender: 'kavindamadhuranga74@gmail.com',
        subject: 'OTP for email verification',
        text: 'Your OTP is ' + new_OTP + '. This OTP is valid for 10 minutes',
      });
    } catch (emailError) {
      // If email fails, revert the OTP update
      user.otp = undefined;
      user.otp_expiry_time = undefined;
      await user.save({ validateModifiedOnly: true });
      throw emailError;
    }

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully',
    });
  } catch (error) {
    console.error('OTP sending failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error sending OTP email',
    });
  }
};

exports.verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  const userDoc = await User.findOne({
    email: email,
    otp_expiry_time: { $gt: Date.now() },
  });

  console.log('userDoc :>> ', userDoc);

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

  const resetToken = userDoc.createPasswordResetToken();
  await userDoc.save({ validateModifiedOnly: true });

  const resetUrl = `http://localhost:3000/auth/reset-password/${resetToken}`;

  try {
    // send email

    try {
      await sendEmail({
        recipient: email,
        sender: 'kavindamadhuranga74@gmail.com',
        subject: 'Password Reset Link',
        text: resetUrl,
      });
    } catch (emailError) {
      // If email fails, revert the OTP update
      userDoc.passwordResetToken = undefined;
      userDoc.passwordResetExpires = undefined;
      await userDoc.save({ validateModifiedOnly: true });
      throw emailError;
    }

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
  //const { token: resetToken } = req.params;
  const { token: resetToken } = req.body;
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
