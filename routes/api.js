// crwn.st REST API — mounts domain routers (paths unchanged under /api)
const express = require('express');
const router = express.Router();

router.use(require('./api/products'));
router.use(require('./api/cart'));
router.use(require('./api/fitting'));
router.use(require('./api/receipts'));
router.use(require('./api/users'));

module.exports = router;
