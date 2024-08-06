const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.headers?.authorization;

    const secretKey = process.env.JWT_SECRET_KEY;

    const decoded = jwt.verify(token, secretKey);

    if (!decoded) {
      return res.status(401).json({
        code: 1001,
        message: 'Unauthorized'
      });
    }

    req.user = decoded;

    next();
  } catch (error) {
    console.log(`[MIDDLEWARE] admin.middleware message: - ${error.message}`);
    return res.status(401).json({
      message: 'Unauthorized'
    });
  }
};
