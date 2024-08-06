const router = require('express').Router();
const controller = require('./booking.controller');

const adminMiddleware = require('../../middleware/admin.middleware');

router.post('/', controller.create);
router.post('/ipn', controller.ipn);
router.post('/query', controller.get);
router.post('/v2', controller.createV2);
router.post('/delete', adminMiddleware, controller.deleteBooking);
router.post('/addNote', adminMiddleware, controller.addNote);
router.post('/reSendMail', controller.reSendMail);

module.exports = router;