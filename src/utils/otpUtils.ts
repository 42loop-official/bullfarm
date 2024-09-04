import * as speakeasy from 'speakeasy';

/**
 * kiểm tra mã otp
 * @param otpSecret 
 * @param otp 
 * @returns 
 */
export function verifyOtp(otpSecret, otp) {
    return speakeasy.totp.verify({
        secret: otpSecret,
        encoding: 'base32',
        token: otp,
        window: 2
    });
}