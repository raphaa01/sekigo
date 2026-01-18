import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(userId) {
  if (!userId) {
    throw new Error('Cannot sign token without userId');
  }
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  if (!token) {
    throw new Error('No token provided');
  }
  return jwt.verify(token, JWT_SECRET);
}

