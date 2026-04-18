import express from 'express';
import User from '../models/User.js';
import Referral from '../models/Referral.js';
import { protectUser } from '../middleware/auth.js';

const router = express.Router();

// Generate referral code for user
router.post('/generate', protectUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user already has a referral code
    if (user.referralCode) {
      return res.json({ referralCode: user.referralCode });
    }
    
    // Generate unique referral code
    const generateReferralCode = () => {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `REF${timestamp}${random}`;
    };
    
    let referralCode = generateReferralCode();
    
    // Ensure uniqueness
    let existingUser = await User.findOne({ referralCode });
    while (existingUser) {
      referralCode = generateReferralCode();
      existingUser = await User.findOne({ referralCode });
    }
    
    user.referralCode = referralCode;
    await user.save();
    
    res.json({ referralCode });
  } catch (error) {
    console.error('Error generating referral code:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get referral stats
router.get('/stats', protectUser, async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id })
      .populate('referredUser', 'username email createdAt')
      .sort({ createdAt: -1 });
    
    const totalEarnings = referrals.reduce((sum, ref) => sum + (ref.earnings || 0), 0);
    const activeReferrals = referrals.filter(ref => ref.status === 'ACTIVE').length;
    const completedReferrals = referrals.filter(ref => ref.status === 'COMPLETED').length;
    
    res.json({
      totalReferrals: referrals.length,
      activeReferrals,
      completedReferrals,
      totalEarnings,
      referrals: referrals.map(ref => ({
        username: ref.referredUser?.username,
        email: ref.referredUser?.email,
        status: ref.status,
        earnings: ref.earnings,
        createdAt: ref.createdAt,
        activatedAt: ref.activatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
