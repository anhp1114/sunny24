const express = require('express');
const router = express.Router();
const multer = require('multer');
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');

const bookingRouter = require('../components/Booking/booking.router');
const roomRouter = require('../components/Room/room.router');
const adminRouter = require('../components/Admin/admin.router');

const adminController = require('../components/Admin/admin.controller');

require('dotenv').config();

const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'ap-southeast-2',
});

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    // acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + '-' + file.originalname);
    },
  }),
});

router.get('/', (req, res) => {
  res.render('index', { title: 'MaryJaneTheHome' });
});
router.use('/booking', bookingRouter);
router.use('/room', roomRouter);
router.use('/admin', adminRouter)
router.use('/siteInfo', require('../components/SiteInfo/siteInfo.router'))
router.use('/branch', require('../components/Branch/branch.router'))
router.post('/upload', upload.single('image'), adminController.upload);

module.exports = router;
