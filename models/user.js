const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First Name is required'],
  },
  lastName: {
    type: String,
    required: [true, 'Last Name is required'],
  },
  about: {
    type: String,
  },
  avatar: {
    type: String,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    validate: {
      validator: function (email) {
        return String(email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          );
      },
      message: (props) => `Email (${props.value}) is invalid!`,
    },
  },
  password: {
    // unselect
    type: String,
  },
  confirmPassowrd: {
    // unselect
    type: String,
  },
  passwordChangedAt: {
    // unselect
    type: Date,
  },
  passwordResetToken: {
    // unselect
    type: String,
  },
  passwordResetExpires: {
    // unselect
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  updatedAt: {
    // unselect
    type: Date,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
  },
  otp_expiry_time: {
    type: Date,
  },
  //   friends: [
  //     {
  //       type: mongoose.Schema.ObjectId,
  //       ref: 'User',
  //     },
  //   ],
  //   socket_id: {
  //     type: String,
  //   },
  //   status: {
  //     type: String,
  //     enum: ['Online', 'Offline'],
  //   },
});

// This will trigger the pre('save') middleware
//  user.password = req.body.newPassword;
//  await user.save();
// this is a pre hook
userSchema.pre('save', async function (next) {
  // Only run this function if OTP  was actually modified
  if (!this.isModified('otp') || !this.otp) return next();

  // Hash the otp with cost of 12
  this.otp = await bcrypt.hash(this.otp.toString(), 12);

  console.log(this.otp.toString(), 'otp FROM PRE SAVE HOOK');

  next();
});

userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password') || !this.password) return next();

  // Hash the otp with cost of 12
  this.password = await bcrypt.hash(this.password.toString(), 12);

  console.log(this.password.toString(), 'password FROM PRE SAVE HOOK');

  next();
});

userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('confirmPassowrd') || !this.confirmPassowrd)
    return next();

  // Hash the otp with cost of 12
  this.confirmPassowrd = await bcrypt.hash(this.confirmPassowrd.toString(), 12);

  console.log(
    this.confirmPassowrd.toString(),
    'confirm pass FROM PRE SAVE HOOK'
  );

  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.correctOTP = async function (candidateOTP, userOTP) {
  return await bcrypt.compare(candidateOTP, userOTP);
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  // access curent user and set the passwordResetToken
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

userSchema.methods.changedPasswordAfter = function (timestamp) {
  return timestamp < this.passwordChangedAt;
};

const User = new mongoose.model('User', userSchema);

module.exports = User;
