// Utilidades de autenticacion: JWT + middleware.
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'musico' },
    SECRET,
    { expiresIn: '30d' }
  );
}

// Middleware: exige un token válido en Authorization: Bearer <token>
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

// Middleware: exige rol de administrador.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo para administradores.' });
  }
  next();
}
