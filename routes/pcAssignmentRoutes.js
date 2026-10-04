const express = require('express');
const router = express.Router();
const pcAssignmentController = require('../controllers/pcAssignmentController');

// Get available PC stations for a laboratory
router.get('/pc-availability', pcAssignmentController.getPCAvailability);

// Assign a PC to a student
router.post('/assign-pc', pcAssignmentController.assignPC);

// End PC usage session
router.post('/end-pc-session', pcAssignmentController.endPCSession);

// Get current PC assignment for a user
router.get('/current-assignment/:userId', pcAssignmentController.getCurrentPCAssignment);

module.exports = router;
