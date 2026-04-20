import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// In-memory OTP storage (for production, use Redis)
const otpStorage = new Map();

const client = twilio(accountSid, authToken);

/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP to phone number
 */
export async function sendOTP(phone) {
  try {
    // Validate phone number (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      throw new Error('Invalid phone number. Must be 10 digits.');
    }

    // Generate OTP
    const otp = generateOTP();
    const expiryTime = Date.now() + (5 * 60 * 1000); // 5 minutes

    // Store OTP with expiry
    otpStorage.set(phone, {
      otp,
      expiry: expiryTime,
      attempts: 0
    });

    // Send SMS via Twilio
    if (accountSid && authToken && twilioPhoneNumber) {
      await client.messages.create({
        body: `Your StockEx verification code is: ${otp}. Valid for 5 minutes.`,
        from: twilioPhoneNumber,
        to: `+91${phone}`
      });
      console.log(`OTP sent to +91${phone}: ${otp}`);
    } else {
      console.log(`Twilio not configured. OTP for +91${phone}: ${otp}`);
    }

    return { success: true, message: 'OTP sent successfully' };
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP. Please try again.');
  }
}

/**
 * Verify OTP
 */
export function verifyOTP(phone, otp) {
  const storedData = otpStorage.get(phone);

  if (!storedData) {
    return { success: false, message: 'OTP not found or expired' };
  }

  // Check if OTP is expired
  if (Date.now() > storedData.expiry) {
    otpStorage.delete(phone);
    return { success: false, message: 'OTP expired. Please request a new one.' };
  }

  // Check if OTP matches
  if (storedData.otp !== otp) {
    storedData.attempts += 1;
    
    // Delete OTP after 3 failed attempts
    if (storedData.attempts >= 3) {
      otpStorage.delete(phone);
      return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
    }
    
    return { success: false, message: `Invalid OTP. ${3 - storedData.attempts} attempts remaining.` };
  }

  // OTP verified successfully
  otpStorage.delete(phone);
  return { success: true, message: 'Phone number verified successfully' };
}

/**
 * Clear expired OTPs (run periodically)
 */
export function clearExpiredOTPs() {
  const now = Date.now();
  for (const [phone, data] of otpStorage.entries()) {
    if (now > data.expiry) {
      otpStorage.delete(phone);
    }
  }
}

// Clear expired OTPs every 5 minutes
setInterval(clearExpiredOTPs, 5 * 60 * 1000);

export default {
  sendOTP,
  verifyOTP,
  clearExpiredOTPs
};
