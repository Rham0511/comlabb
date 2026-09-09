
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { User } from "../models/userModel.js";
import { logAuditEntry } from "./auditController.js";
import crypto from 'crypto';
import { sendMail, sendOtpMail } from '../utils/mailer.js';
await User.sync({ alter: true });

// ─── Helpers ────────────────────────────────────────────────────────────────

const getSafeRedirectTarget = (redirectTo) => {
  if (typeof redirectTo !== "string") return null;
  const trimmed = redirectTo.trim();
  if (!trimmed || !trimmed.startsWith("/")) return null;
  return trimmed;
};

/** Generate a cryptographically random 6-digit OTP string */
const generateOtp = () => String(crypto.randomInt(100000, 999999));

/** OTP valid for 10 minutes */
const OTP_TTL_MS = 10 * 60 * 1000;

const getSmtpErrorMessage = (error) => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('smtp not configured') || message.includes('not configured')) {
    return 'Email could not be sent because SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env file, then restart the app.';
  }
  if (message.includes('invalid login') || message.includes('badcredentials') || message.includes('username and password not accepted')) {
    return 'Email could not be sent because your SMTP credentials were rejected. Please verify SMTP_USER and SMTP_PASS.';
  }
  return 'Email could not be sent right now. Please check your SMTP configuration and try again.';
};

// ─── Role helpers ────────────────────────────────────────────────────────────

export const normalizeUserRole = (role) => {
  const normalized = String(role || "admin").trim().toLowerCase();
  if (["admin", "administrator", "instructor", "instructors"].includes(normalized)) return "admin";
  if (normalized === "technician") return "technician";
  if (normalized === "student") return "student";
  return "admin";
};

export const normalizeCampusValue = (campus) => {
  const allowed = ["Bongabong", "Victoria", "Calapan"];
  const normalized = String(campus ?? "").trim();
  if (!normalized) return null;
  const match = allowed.find((option) => option.toLowerCase() === normalized.toLowerCase());
  return match || null;
};

const redirectAfterLogin = (req, res, fallback = "/student/dashboard") => {
  const redirectTo = getSafeRedirectTarget(req.session.redirectTo);
  delete req.session.redirectTo;
  return res.redirect(redirectTo || fallback);
};

// ─── Page renders ────────────────────────────────────────────────────────────

export const loginPage        = (req, res) => res.render("login",          { title: "Login" });
export const registerPage     = (req, res) => res.render("register",       { title: "Register" });
export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password" });
export const dashboardPage    = (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  return res.redirect("/admin-dashboard");
};

// ─── Login ───────────────────────────────────────────────────────────────────

export const loginUser = async (req, res) => {
  const rawEmail = String(req.body?.email ?? "");
  const rawPassword = String(req.body?.password ?? "");
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const normalizedPassword = rawPassword.trim();

  const user = await User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    await logAuditEntry(req, {
      action: "Failed Login",
      module: "Authentication",
      description: `Failed login attempt for ${normalizedEmail}: user not found.`
    });
    req.flash("error_msg", "User not found. Please register first.");
    return res.redirect("/login");
  }

  const match = await bcrypt.compare(normalizedPassword, user.password);
  if (!match) {
    await logAuditEntry(req, {
      action: "Failed Login",
      module: "Authentication",
      description: `Failed login attempt for ${normalizedEmail}: incorrect password.`
    });
    req.flash("error_msg", "Incorrect password. Please try again.");
    return res.redirect("/login");
  }

  const normalizedRole = normalizeUserRole(user.role);

  // Block unverified accounts
  if (!user.email_verified) {
    req.flash('error_msg', 'Please verify your email address before logging in.');
    return res.redirect('/login');
  }

  req.session.userId   = user.id;
  req.session.userRole = normalizedRole;
  req.session.userCampus = user.campus || null;
  await user.update({ last_login_at: new Date(), role: normalizedRole });
  await logAuditEntry(req, {
    action: "Login",
    module: "Authentication",
    description: `User ${user.email} logged in successfully.`
  });

  // Explicitly save session before redirect to ensure userRole persists
  return req.session.save((err) => {
    if (err) {
      console.error("[auth] Session save error:", err);
      req.flash("error_msg", "Login failed. Please try again.");
      return res.redirect("/login");
    }
    if (normalizedRole === "technician") return redirectAfterLogin(req, res, "/technician-dashboard");
    if (normalizedRole === "student")    return redirectAfterLogin(req, res, "/student/dashboard");
    return redirectAfterLogin(req, res, "/admin-dashboard");
  });
};

// ─── Registration with OTP ───────────────────────────────────────────────────

export const registerUser = async (req, res) => {
  const { name, email, password, confirmPassword, role, student_number, program, year, section, campus } = req.body;

  if (!name || !email || !password || !confirmPassword || !campus) {
    req.flash("error_msg", "Please complete all registration fields, including campus.");
    return res.redirect("/register");
  }

  const normalizedCampus = normalizeCampusValue(campus);
  if (!normalizedCampus) {
    req.flash("error_msg", "Invalid campus. Please select Bongabong, Victoria, or Calapan.");
    return res.redirect("/register");
  }

  if (password !== confirmPassword) {
    req.flash("error_msg", "Passwords do not match.");
    return res.redirect("/register");
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser && existingUser.email_verified) {
    req.flash("error_msg", "An account with that email already exists.");
    return res.redirect("/register");
  }

  const normalizedRole = normalizeUserRole(role);
  const hashed         = await bcrypt.hash(password, 8);
  const otp            = generateOtp();
  const otpExpiresAt   = new Date(Date.now() + OTP_TTL_MS);

  let user;
  if (existingUser && !existingUser.email_verified) {
    // Re-use the pending account, refresh OTP
    await existingUser.update({
      name,
      password: hashed,
      role: normalizedRole,
      student_number: student_number?.trim() || null,
      program: program?.trim() || null,
      year: year?.trim() || null,
      section: section?.trim() || null,
      campus: normalizedCampus,
      otp_code: otp,
      otp_expires_at: otpExpiresAt,
      otp_purpose: 'registration'
    });
    user = existingUser;
  } else {
    user = await User.create({
      name,
      email,
      password: hashed,
      role: normalizedRole,
      student_number: student_number?.trim() || null,
      program: program?.trim() || null,
      year: year?.trim() || null,
      section: section?.trim() || null,
      campus: normalizedCampus,
      last_login_at: null,
      email_verified: false,
      otp_code: otp,
      otp_expires_at: otpExpiresAt,
      otp_purpose: 'registration'
    });
  }

  await logAuditEntry(req, {
    action: "User Created",
    module: "User Management",
    resourceId: user.id,
    description: `New user account created for ${user.email} (${normalizedRole}) — OTP verification required.`,
    details: { email: user.email, role: normalizedRole, campus: normalizedCampus }
  });

  console.log(`[auth] OTP generated for registration: ${email}`);

  try {
    await sendOtpMail({ to: email, name, otp, purpose: 'registration' });
    console.log('[auth] OTP email sent successfully.');
  } catch (err) {
    console.error(`[auth] OTP email failed for ${email}:`, err?.message || err);
    // Delete user if we couldn't send the OTP (they can retry registration)
    await user.destroy().catch(() => {});
    req.flash('error_msg', getSmtpErrorMessage(err));
    return res.redirect('/register');
  }

  // Store email in session so the OTP page knows who to verify
  req.session.otpEmail   = email;
  req.session.otpPurpose = 'registration';
  return res.redirect('/verify-otp');
};

// ─── OTP Verification (registration & password reset) ────────────────────────

export const verifyOtpPage = (req, res) => {
  const email   = req.session.otpEmail;
  const purpose = req.session.otpPurpose;
  if (!email || !purpose) {
    req.flash('error_msg', 'Session expired. Please start again.');
    return res.redirect('/register');
  }
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  return res.render('verify-otp', { title: 'Verify Your Email', maskedEmail, purpose });
};

export const verifyOtp = async (req, res) => {
  const email   = req.session.otpEmail;
  const purpose = req.session.otpPurpose;

  if (!email || !purpose) {
    req.flash('error_msg', 'Session expired. Please start again.');
    return res.redirect('/register');
  }

  // Collect digits — support both combined `otp` field and individual digit fields
  let enteredOtp = req.body.otp;
  if (!enteredOtp) {
    const digits = ['d1','d2','d3','d4','d5','d6'].map(k => (req.body[k] || '').trim());
    enteredOtp = digits.join('');
  }
  enteredOtp = String(enteredOtp || '').trim();

  if (!/^\d{6}$/.test(enteredOtp)) {
    req.flash('error_msg', 'Please enter the complete 6-digit code.');
    return res.redirect('/verify-otp');
  }

  const user = await User.findOne({ where: { email, otp_purpose: purpose } });

  if (!user) {
    req.flash('error_msg', 'Invalid request. Please start again.');
    return res.redirect(purpose === 'password_reset' ? '/forgot-password' : '/register');
  }

  if (!user.otp_code || user.otp_code !== enteredOtp) {
    req.flash('error_msg', 'Incorrect code. Please try again.');
    return res.redirect('/verify-otp');
  }

  if (user.otp_expires_at && new Date() > new Date(user.otp_expires_at)) {
    req.flash('error_msg', 'Your code has expired. Please request a new one.');
    await user.update({ otp_code: null, otp_expires_at: null, otp_purpose: null });
    return res.redirect(purpose === 'password_reset' ? '/forgot-password' : '/register');
  }

  if (purpose === 'registration') {
    await user.update({
      email_verified: true,
      otp_code: null,
      otp_expires_at: null,
      otp_purpose: null
    });
    await logAuditEntry(req, {
      action: 'Email Verified',
      module: 'Authentication',
      resourceId: user.id,
      description: `User ${user.email} verified their email via OTP.`
    });
    delete req.session.otpEmail;
    delete req.session.otpPurpose;
    req.flash('success_msg', 'Email verified! You can now log in.');
    return res.redirect('/login');
  }

  if (purpose === 'password_reset') {
    // OTP is valid — let them set a new password
    // Clear the OTP so it can't be reused, keep a reset token in session
    const resetToken = crypto.randomBytes(32).toString('hex');
    await user.update({
      otp_code: null,
      otp_expires_at: null,
      otp_purpose: null,
      verification_token: resetToken,
      verification_expires_at: new Date(Date.now() + 15 * 60 * 1000) // 15 min
    });
    delete req.session.otpEmail;
    delete req.session.otpPurpose;
    req.session.resetToken = resetToken;
    req.session.resetEmail = email;
    return res.redirect('/reset-password');
  }
};

export const resendOtp = async (req, res) => {
  const email   = req.session.otpEmail;
  const purpose = req.session.otpPurpose;

  if (!email || !purpose) {
    req.flash('error_msg', 'Session expired. Please start again.');
    return res.redirect('/register');
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    req.flash('error_msg', 'Account not found. Please register again.');
    return res.redirect('/register');
  }

  const otp          = generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await user.update({ otp_code: otp, otp_expires_at: otpExpiresAt, otp_purpose: purpose });

  try {
    await sendOtpMail({ to: email, name: user.name, otp, purpose });
    req.flash('success_msg', 'A new code has been sent to your email.');
  } catch (err) {
    console.error('[auth] Resend OTP failed:', err?.message || err);
    req.flash('error_msg', getSmtpErrorMessage(err));
  }

  return res.redirect('/verify-otp');
};

// ─── Forgot Password ─────────────────────────────────────────────────────────

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    req.flash('error_msg', 'Please enter your email address.');
    return res.redirect('/forgot-password');
  }

  const user = await User.findOne({ where: { email } });

  // Always show success to avoid email enumeration
  if (!user) {
    req.flash('success_msg', 'If that email is registered, you will receive a reset code shortly.');
    return res.redirect('/forgot-password');
  }

  const otp          = generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await user.update({ otp_code: otp, otp_expires_at: otpExpiresAt, otp_purpose: 'password_reset' });

  console.log(`[auth] Password reset OTP generated for: ${email}`);

  try {
    await sendOtpMail({ to: email, name: user.name, otp, purpose: 'password_reset' });
    console.log('[auth] Password reset OTP email sent.');
  } catch (err) {
    console.error(`[auth] Password reset OTP email failed for ${email}:`, err?.message || err);
    req.flash('error_msg', getSmtpErrorMessage(err));
    return res.redirect('/forgot-password');
  }

  req.session.otpEmail   = email;
  req.session.otpPurpose = 'password_reset';
  return res.redirect('/verify-otp');
};

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPasswordPage = (req, res) => {
  if (!req.session.resetToken || !req.session.resetEmail) {
    req.flash('error_msg', 'Invalid or expired reset session. Please start again.');
    return res.redirect('/forgot-password');
  }
  return res.render('reset-password', { title: 'Reset Password' });
};

export const resetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;
  const resetToken = req.session.resetToken;
  const resetEmail = req.session.resetEmail;

  if (!resetToken || !resetEmail) {
    req.flash('error_msg', 'Invalid or expired reset session. Please start again.');
    return res.redirect('/forgot-password');
  }

  if (!password || !confirmPassword) {
    req.flash('error_msg', 'Please fill in both password fields.');
    return res.redirect('/reset-password');
  }

  if (password !== confirmPassword) {
    req.flash('error_msg', 'Passwords do not match.');
    return res.redirect('/reset-password');
  }

  if (password.length < 8) {
    req.flash('error_msg', 'Password must be at least 8 characters.');
    return res.redirect('/reset-password');
  }

  const user = await User.findOne({ where: { email: resetEmail, verification_token: resetToken } });

  if (!user) {
    req.flash('error_msg', 'Reset session not found. Please start again.');
    return res.redirect('/forgot-password');
  }

  if (user.verification_expires_at && new Date() > new Date(user.verification_expires_at)) {
    req.flash('error_msg', 'Reset session expired. Please start again.');
    await user.update({ verification_token: null, verification_expires_at: null });
    return res.redirect('/forgot-password');
  }

  const hashed = await bcrypt.hash(password, 8);
  await user.update({
    password: hashed,
    verification_token: null,
    verification_expires_at: null
  });

  await logAuditEntry(req, {
    action: 'Password Reset',
    module: 'Authentication',
    resourceId: user.id,
    description: `User ${user.email} successfully reset their password.`
  });

  delete req.session.resetToken;
  delete req.session.resetEmail;

  req.flash('success_msg', 'Password reset successfully. You can now log in with your new password.');
  return res.redirect('/login');
};

// ─── Legacy token-based email verify (kept for backward compat) ───────────────

export const verifyEmail = async (req, res) => {
  const { token } = req.params;
  if (!token) {
    req.flash('error_msg', 'Invalid verification link.');
    return res.redirect('/login');
  }
  const user = await User.findOne({ where: { verification_token: token } });
  if (!user) {
    return res.render('verify-result', { title: 'Verification', success: false, message: 'Invalid or already-used verification link.' });
  }
  if (user.email_verified) {
    return res.render('verify-result', { title: 'Verification', success: true, message: 'Email already verified. You may log in.' });
  }
  if (user.verification_expires_at && new Date() > new Date(user.verification_expires_at)) {
    return res.render('verify-result', { title: 'Verification', success: false, message: 'Verification link expired. Please request a new verification.' });
  }
  await user.update({ email_verified: true, verification_token: null, verification_expires_at: null });
  await logAuditEntry(req, { action: 'Email Verified', module: 'Authentication', resourceId: user.id, description: `User ${user.email} verified their email.` });
  return res.render('verify-result', { title: 'Verification', success: true, message: 'Email verified successfully. You may now log in.' });
};

// ─── Profile & Photo ──────────────────────────────────────────────────────────

export const updateProfile = async (req, res) => {
  if (!req.session?.userId) {
    if (req.accepts("html")) {
      req.flash("error_msg", "Please log in to update your profile.");
      return res.redirect("/login");
    }
    return res.status(401).json({ success: false, error: "Please log in to update your profile." });
  }

  const { student_number, program, year, section } = req.body;
  const payload = {
    student_number: student_number?.trim() || null,
    program: program?.trim() || null,
    year: year?.trim() || null,
    section: section?.trim() || null
  };

  await User.update(payload, { where: { id: req.session.userId } });
  await logAuditEntry(req, {
    action: "User Updated",
    module: "User Management",
    resourceId: req.session.userId,
    description: `User profile updated for ${req.session.userId}.`,
    details: payload
  });

  if (req.accepts("html")) {
    req.flash("success_msg", "Profile updated successfully.");
    return res.redirect("/student/profile");
  }
  return res.json({ success: true, profile: payload });
};

export const logoutUser = async (req, res) => {
  await logAuditEntry(req, {
    action: "Logout",
    module: "Authentication",
    description: `User ${req.session?.userId || 'unknown'} logged out.`
  });
  req.session.destroy();
  res.redirect("/login");
};

export const uploadStudentPhoto = async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, error: "Please log in to upload a profile photo." });
  }

  const { image, fileName } = req.body || {};
  if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
    return res.status(400).json({ success: false, error: "Invalid image data." });
  }

  const user = await User.findByPk(req.session.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found." });
  }

  if ((user.role || "").toLowerCase() !== "student") {
    return res.status(403).json({ success: false, error: "Only students can upload profile photos." });
  }

  const matches = image.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.*)$/i);
  if (!matches) {
    return res.status(400).json({ success: false, error: "Invalid image upload format." });
  }

  const mimeType = matches[1].toLowerCase();
  const base64Data = matches[3];
  const acceptedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!acceptedTypes.includes(mimeType)) {
    return res.status(400).json({ success: false, error: "Only JPG, JPEG, PNG, and WEBP images are allowed." });
  }

  const imageBuffer = Buffer.from(base64Data, "base64");
  const maxSizeBytes = 5 * 1024 * 1024;
  if (imageBuffer.length > maxSizeBytes) {
    return res.status(400).json({ success: false, error: "Image file size must be 5MB or less." });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "profiles");
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const safeBaseName = path.basename(fileName || `${user.id}`);
  const extension    = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
  const filename     = `${user.id}-${Date.now()}-${safeBaseName.replace(/[^a-zA-Z0-9.-]/g, "-")}.${extension}`;
  const filePath     = path.join(uploadDir, filename);
  const publicUrl    = `/uploads/profiles/${filename}`;

  try {
    if (user.photo) {
      const previousPath = user.photo.startsWith("/") ? user.photo.slice(1) : user.photo;
      const previousFile = path.join(process.cwd(), "public", previousPath);
      if (previousFile !== filePath && fs.existsSync(previousFile)) {
        await fs.promises.unlink(previousFile).catch(() => {});
      }
    }
    await fs.promises.writeFile(filePath, imageBuffer);
    await User.update({ photo: publicUrl }, { where: { id: user.id } });
    return res.json({ success: true, photo: publicUrl });
  } catch (error) {
    console.error("Failed to save student profile photo:", error);
    return res.status(500).json({ success: false, error: "Unable to save the profile photo." });
  }
};
