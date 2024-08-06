const router = require('express').Router();
const _ = require('lodash');

const controller = require('./siteInfo.controller');

const adminMiddleware = require('../../middleware/admin.middleware');

router.post('/', controller.getSiteInfo);
router.post('/update', adminMiddleware, controller.updateSiteInfo);

module.exports = router;