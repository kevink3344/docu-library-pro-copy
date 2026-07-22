import { Router } from 'express';
import { getLoginModeOverride } from '../lib/auth.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    loginModeOverride: getLoginModeOverride(),
  });
});

export default router;
