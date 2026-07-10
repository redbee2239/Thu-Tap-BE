import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

const app = express();
const JWT_SECRET = 'RedBee';
const REFRESH_SECRET = 'RedBeeRefresh';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ponytail: simplified in-memory store, replace with DB in Capstone
const users: { id: string; email: string; password: string; refreshToken?: string; role: string }[] = [];

interface AuthenticatedRequest extends Request {
    user?: { id: string; role: string };
}

const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
        res.status(401).json({ message: 'Không tìm thấy token hợp lệ' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }
};

const requireRole = (role: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user || req.user.role !== role) {
            res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
            return;
        }
        next();
    };
};

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: 'Too many login attempts, please try again later'
});

app.post('/auth/register', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ message: 'Email đã tồn tại' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: String(users.length + 1), email, password: hashedPassword, role: 'MEMBER' };
    users.push(newUser);
    res.status(201).json({ message: 'Đăng ký thành công' });
});

app.post('/auth/login', authLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }
    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
    user.refreshToken = refreshToken;
    res.json({ accessToken, refreshToken });
});

app.post('/auth/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token required' });

    const user = users.find(u => u.refreshToken === refreshToken);
    if (!user) return res.status(403).json({ message: 'Token làm mới không hợp lệ' });

    try {
        jwt.verify(refreshToken, REFRESH_SECRET);
        const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
        res.json({ accessToken });
    } catch (error) {
        res.status(403).json({ message: 'Token đã hết hạn hoặc không tồn tại' });
    }
});

app.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = users.find(u => u.id === req.user?.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password, ...userData } = user;
    res.json(userData);
});

app.delete('/project/:id', requireAuth, requireRole('OWNER'), (req: Request, res: Response) => {
    res.json({ message: 'Xoá dự án thành công!' });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
