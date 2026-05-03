import Admin from '../models/Admin.js';
import { 
  validateBrokerageRestrictionData, 
  getBrokerageRestrictionStatus 
} from '../services/brokerageRestrictionService.js';

/**
 * Get brokerage restriction settings for an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getBrokerageRestriction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const admin = await Admin.findById(id)
      .select('restrictMode username name role adminCode');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const restrictionStatus = getBrokerageRestrictionStatus(admin);
    
    res.json({
      admin: {
        _id: admin._id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        adminCode: admin.adminCode
      },
      brokerageRestriction: restrictionStatus
    });
  } catch (error) {
    console.error('Error fetching brokerage restriction:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update brokerage restriction settings for an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateBrokerageRestriction = async (req, res) => {
  try {
    const { id } = req.params;
    const { restrictBrokerage } = req.body;
    
    // Validate input data
    const validation = validateBrokerageRestrictionData({ restrictBrokerage });
    if (!validation.isValid) {
      return res.status(400).json({ 
        message: 'Invalid data', 
        errors: validation.errors 
      });
    }
    
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Initialize restrictMode if it doesn't exist
    if (!admin.restrictMode) {
      admin.restrictMode = {};
    }

    // Update brokerage restriction settings
    admin.restrictMode.restrictBrokerage = {
      games: restrictBrokerage?.games || false,
      trading: restrictBrokerage?.trading || false
    };

    await admin.save();

    const restrictionStatus = getBrokerageRestrictionStatus(admin);

    res.json({
      message: 'Brokerage restriction updated successfully',
      admin: {
        _id: admin._id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
        adminCode: admin.adminCode
      },
      brokerageRestriction: restrictionStatus
    });
  } catch (error) {
    console.error('Error updating brokerage restriction:', error);
    res.status(500).json({ message: error.message });
  }
};
