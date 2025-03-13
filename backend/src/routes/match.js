const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Public routes
router.get('/', matchController.getMatches);
router.get('/upcoming', matchController.getUpcomingMatches);
router.get('/live', matchController.getLiveMatches);
router.get('/completed', matchController.getCompletedMatches);
router.get('/:id', matchController.getMatch);
router.get('/:id/lineup', matchController.getMatchLineup);
router.get('/:id/stats', matchController.getMatchStats);

// Protected routes
router.use(protect);

// Admin only routes
router.use(restrictTo('admin'));
router.patch('/:id/score', matchController.updateMatchScore);
router.patch('/:id/complete', matchController.completeMatch);

module.exports = router;
