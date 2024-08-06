const router = require('express').Router();
const _ = require('lodash');

const adminMiddleware = require('../../middleware/admin.middleware');

const controller = require('./room.controller');

router.post('/', adminMiddleware, controller.createRoom);
router.post('/search', controller.searchRoom);
router.post('/checkAvailable', controller.checkAvailable);

module.exports = router;