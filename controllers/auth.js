const jwt = require('jsonwebtoken');
const User = require('../models/user');
const filterObjects = require('../utils/filterObjects');
const otpGenerator = require('otp-generator');

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

exports.forgotPassword = async (req, res, next) => {};

exports.resetPassword = async (req, res, next) => {};
