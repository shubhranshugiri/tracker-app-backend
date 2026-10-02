import express from 'express';
import { User } from '../models/User.js';
import { generateToken, protect, authorize } from '../middleware/auth.js';
import { isDbConnected } from '../db/connect.js';

const router = express.Router();

const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL || 'girishubhranshu3@gmail.com';
const AUTHORIZED_PASS = process.env.AUTHORIZED_PASSWORD || 'User@123';

// @route   POST /api/auth/register
// @desc    Public registration is strictly disabled per requirement
router.post('/register', (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Public registration is disabled. Fleet tracking is restricted to authorized credentials only.'
  });
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get JWT token
// @access  Public (Strictly restricted to authorized credentials)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. If MongoDB is connected, verify against database
    if (isDbConnected) {
      const user = await User.findOne({ email: cleanEmail }).select('+password');

      if (user) {
        const isMatch = await user.matchPassword(password);
        if (isMatch) {
          if (!user.isActive) {
            return res.status(403).json({
              success: false,
              message: 'Your account has been deactivated.'
            });
          }

          const token = generateToken(user);
          return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role
            }
          });
        }
      }
    }

    // 2. Strict Check for the requested user credentials: girishubhranshu3@gmail.com / User@123
    if (cleanEmail === AUTHORIZED_EMAIL.toLowerCase() && password === AUTHORIZED_PASS) {
      const authUser = {
        id: 'user-shubhranshu-1',
        name: 'Shubhranshu Giri',
        email: AUTHORIZED_EMAIL,
        role: 'admin',
        isActive: true
      };

      const token = generateToken(authUser);
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: authUser
      });
    }

    // Invalid credentials
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. Only authorized fleet operators are permitted access.'
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ success: false, message: 'Server login error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user profile
// @access  Protected
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id || req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt || new Date()
    }
  });
});

export default router;
