const router = require('express').Router();
const _ = require('lodash');
const path = require('path');

const controller = require('./admin.controller');

router.post('/login', controller.login);
router.post('/changePassword', controller.changePassword);


module.exports = router;
