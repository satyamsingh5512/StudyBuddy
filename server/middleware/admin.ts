import { Request, Response, NextFunction } from 'express';

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user && (req.user as any).role === 'admin') {
        return next();
    }

    if (req.session?.role === 'admin') {
        return next();
    }

    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
};
