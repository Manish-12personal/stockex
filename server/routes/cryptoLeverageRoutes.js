import express from 'express';
import { protectUser } from '../middleware/auth.js';
import {
  getMyAccount,
  configureMyAccount,
  getMyLimits,
  openMyPosition,
  runMyMarketClose,
  squareOffMyPosition,
  checkMyMarginRisk,
  listMyTransactions,
  listMyPositions,
} from '../controllers/cryptoLeverageTradingController.js';

const router = express.Router();

/** All routes require a logged-in platform user; crypto account is auto-provisioned. */
router.use(protectUser);

router.get('/account/me', getMyAccount);
router.post('/account/me/configure', configureMyAccount);
router.get('/limits/me', getMyLimits);
router.get('/positions/me', listMyPositions);
router.get('/transactions/me', listMyTransactions);

router.post('/positions/open', openMyPosition);
router.post('/market-close/me', runMyMarketClose);
router.post('/square-off/me', squareOffMyPosition);
router.post('/risk/check/me', checkMyMarginRisk);

export default router;
