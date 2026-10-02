import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { isDbConnected } from '../db/connect.js';

// Generate signed JWT token with user claims
export function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'fleetpro_super_secure_jwt_secret_token_2026_xyz';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const payload = {
    id: user._id ? user._id.toString() : user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'operator'
  };
  return jwt.sign(payload, secret, { expiresIn });
}

// Authentication Middleware: Protect routes from unauthenticated access
export async function protect(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. Bearer token missing.'
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'fleetpro_super_secure_jwt_secret_token_2026_xyz';
    const decoded = jwt.verify(token, secret);

    let user = null;
    if (isDbConnected) {
      try {
        user = await User.findById(decoded.id).select('-password');
      } catch (err) {
        console.warn('DB user lookup fallback:', err.message);
      }
    }

    if (!user) {
      user = {
        _id: decoded.id,
        name: decoded.name || 'Fleet Operator',
        email: decoded.email || 'operator@fleetpro.io',
        role: decoded.role || 'operator',
        isActive: true
      };
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This user account has been deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Invalid or expired token.'
    });
  }
}

// Role Authorization Middleware (e.g. authorize('admin', 'manager'))
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user?.role}' is not authorized to access this route`
      });
    }
    next();
  };
}
