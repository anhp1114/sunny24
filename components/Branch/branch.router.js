const router = require('express').Router();
const _ = require('lodash');

const adminMiddleware = require('../../middleware/admin.middleware');

const controller = require('./branch.controller');

router.post('/', adminMiddleware, controller.createBranch);
router.get('/', controller.getBranchs);
router.delete('/', adminMiddleware, controller.deleteBranch);

module.exports = router;