"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const passport_2 = require("../config/passport");
const router = (0, express_1.Router)();
router.get('/google', (req, res, next) => {
    if (!passport_2.isGoogleAuthConfigured) {
        return res.status(503).json({
            error: 'Google OAuth is not configured. Please contact the administrator.',
        });
    }
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
    })(req, res, next);
});
router.get('/google/callback', (req, res, next) => {
    if (!passport_2.isGoogleAuthConfigured) {
        return res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
    }
    passport_1.default.authenticate('google', { failureRedirect: '/' })(req, res, () => {
        res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
    });
});
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    }
    else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});
router.post('/logout', (req, res) => {
    req.logout(() => {
        res.json({ success: true });
    });
});
exports.default = router;
