import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User, sequelize } from './models/userModel.js';
import { sendMail, getSmtpConfigStatus } from './utils/mailer.js';
import { verifyEmail } from './controllers/authController.js';

dotenv.config();

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return 'unknown';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
};

const getPlusAliasEmail = (base, suffix) => {
  const parts = String(base || '').split('@');
  if (parts.length !== 2) return `${base}`;
  return `${parts[0]}+smtpverify${suffix}@${parts[1]}`;
};

const createTempUser = async (email, name) => {
  const password = 'TempPass#1234';
  const hashed = await bcrypt.hash(password, 8);
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const user = await User.create({
    name,
    email,
    password: hashed,
    role: 'student',
    student_number: null,
    program: null,
    year: null,
    section: null,
    last_login_at: null,
    email_verified: false,
    verification_token: token,
    verification_expires_at: expiresAt
  });
  return { user, password, token, expiresAt };
};

const loginCheck = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  if (!user) return { success: false, reason: 'User not found' };
  const match = await bcrypt.compare(password, user.password);
  if (!match) return { success: false, reason: 'Incorrect password' };
  if (!user.email_verified) return { success: false, reason: 'Email not verified' };
  return { success: true, user };
};

const run = async () => {
  const smtpStatus = getSmtpConfigStatus();
  if (!smtpStatus.isConfigured) {
    throw new Error('SMTP is not configured: missing ' + smtpStatus.missing.join(', '));
  }

  const smtpUser = process.env.SMTP_USER;
  if (!smtpUser) {
    throw new Error('SMTP_USER not configured');
  }

  const suffix = Date.now();
  const testEmail1 = getPlusAliasEmail(smtpUser, `a${suffix}`);
  const testEmail2 = getPlusAliasEmail(smtpUser, `b${suffix}`);

  console.log('Starting SMTP verification test');
  console.log('Using SMTP recipient alias:', maskEmail(testEmail1));

  let user1;
  let user2;

  try {
    const created1 = await createTempUser(testEmail1, 'Temp Verify A');
    user1 = created1.user;
    console.log('Step 1: Created temporary test account 1');

    const loaded1 = await User.findByPk(user1.id);
    if (!loaded1) throw new Error('Failed to reload test account 1');
    console.log('Step 2: Confirmed account starts unverified:', loaded1.email_verified === false);
    if (loaded1.email_verified !== false) throw new Error('Account 1 unexpectedly already verified');

    const hasToken = loaded1.verification_token != null;
    const hasExpires = loaded1.verification_expires_at != null;
    console.log('Step 3: Verification token present:', hasToken, 'expiration present:', hasExpires);
    if (!hasToken || !hasExpires) throw new Error('Account 1 missing token or expiration');

    const verifyUrl = `https://example.com/verify-email/${loaded1.verification_token}`;
    await sendMail({ to: testEmail1, subject: 'SMTP Verification Test', html: `<p>Test email for verification. Link: <a href="${verifyUrl}">${verifyUrl}</a></p>` });
    console.log('Step 4: Sent verification email via SMTP to configured recipient alias');

    const fakeReq = {
      params: { token: loaded1.verification_token },
      session: {},
      flash: () => {}
    };
    const fakeRes = {
      rendered: null,
      redirectPath: null,
      render(view, data) {
        this.rendered = { view, data };
        return data;
      },
      redirect(path) {
        this.redirectPath = path;
        return path;
      }
    };

    await verifyEmail(fakeReq, fakeRes);
    const resultData = fakeRes.rendered?.data;
    if (!resultData || resultData.success !== true) {
      throw new Error('Verification controller failed: ' + JSON.stringify(resultData));
    }
    console.log('Step 5: Verified the account using the application verification flow');

    const reloaded1 = await User.findByPk(user1.id);
    if (!reloaded1) throw new Error('Failed to reload verified account 1');
    console.log('Step 6: Confirmed email_verified true:', reloaded1.email_verified === true);
    if (reloaded1.email_verified !== true) throw new Error('Account 1 did not verify correctly');

    const clearedToken = reloaded1.verification_token === null;
    const clearedExpires = reloaded1.verification_expires_at === null;
    console.log('Step 7: Confirmed token cleared:', clearedToken, 'and expiration cleared:', clearedExpires);
    if (!clearedToken || !clearedExpires) throw new Error('Token or expiration was not cleared after verification');

    const created2 = await createTempUser(testEmail2, 'Temp Verify B');
    user2 = created2.user;
    console.log('Step 8: Created second temporary unverified account');

    const blockedLogin = await loginCheck(testEmail2, created2.password);
    console.log('Step 9: Confirmed unverified login blocked:', blockedLogin.success === false, 'reason:', blockedLogin.reason);
    if (blockedLogin.success) throw new Error('Unverified login unexpectedly succeeded for account 2');

    const verifiedLogin = await loginCheck(testEmail1, created1.password);
    console.log('Step 10: Confirmed verified login succeeds:', verifiedLogin.success === true);
    if (!verifiedLogin.success) throw new Error('Verified login failed for account 1');

    console.log('All verification test steps passed successfully.');
  } finally {
    if (user1) {
      await User.destroy({ where: { id: user1.id } });
      console.log('Deleted temporary account 1');
    }
    if (user2) {
      await User.destroy({ where: { id: user2.id } });
      console.log('Deleted temporary account 2');
    }
    await sequelize.close();
  }
};

run().catch((error) => {
  console.error('Verification test failed:', error.message);
  process.exit(1);
});
