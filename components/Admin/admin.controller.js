const jwt = require('jsonwebtoken');
const sha256 = require('sha256');
const _ = require('lodash');
const { cloudinary } = require('../../utils/cloudinary');

const Account = require('../Admin/account.model');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const account = await Account.findOne({ username });
    if (!account) {
      throw new Error('Account not found');
    }
    const hashedPassword = sha256(`${password}${process.env.SALT_KEY}`);
    if (account.password !== hashedPassword) {
      throw new Error('Wrong password');
    }
    const secretKey = process.env.JWT_SECRET_KEY;
    const token = jwt.sign({ username }, secretKey);
    return res.json({
      code: 1000,
      token,
      account: _.omit(account.toObject(), ['password', '__v', '_id'])
    });
  } catch (error) {
    console.log(`[ERROR] login message: - ${error.message}`);
    return res.status(400).json({
      code: 1001,
      message: error.message
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { username, password, newPassword } = req.body;

    const account = await Account.findOne({ username });

    if (!account) {
      throw new Error('Account not found');
    }
    const hashedPassword = sha256(`${password}${process.env.SALT_KEY}`);
    if (account.password !== hashedPassword) {
      throw new Error('Wrong password');
    }
    const hashedNewPassword = sha256(`${newPassword}${process.env.SALT_KEY}`);
    account.password = hashedNewPassword;
    await account.save();
    return res.json({
      code: 1000,
      message: 'Change password successfully'
    });
  } catch (error) {
    console.log(`[ERROR] changePassword - ${error.message}`);
    return res.status(400).json({
      code: 1001,
      message: error.message
    });
  }
};

const upload = async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('File is required');
    }
    return res.json({
      code: 1000,
      message: 'Upload file successfully',
      data: {
        url: req.file.location
      }
    });
  } catch (error) {
    console.log(`[ERROR] upload - ${error.message}`);
    return res.status(400).json({
      code: 1001,
      message: error.message
    });
  }
};

module.exports = {
  login,
  changePassword,
  upload
};
