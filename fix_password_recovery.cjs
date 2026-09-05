const fs = require('fs');
const path = require('path');

const authPath = path.join(process.cwd(), 'server/routes/auth.ts');
let content = fs.readFileSync(authPath, 'utf-8');

// The recover-password route needs to take OTP challenge Id instead of recovery key.
// But first, let's just make it simple: if you have the recovery key OR a valid OTP challenge that is verified.
// The prompt says "Password recovery must require valid proof. A missing credential or missing recovery factor must NEVER allow reset."

// Actually, I can leave the existing recoveryKey fallback, but maybe just switch it to OTP.
const replace = `
authRouter.post('/recover-password', (req, res) => {
  let { mobile, newPassword, otpChallengeId } = req.body;
  mobile = normalizeMobile(mobile);
  
  if (!mobile || !newPassword || !otpChallengeId) {
    return res.status(400).json({ success: false, error: 'شماره موبایل، رمز عبور جدید و شناسه تایید الزامی است.' });
  }

  // Check OTP challenge was verified
  const challenge = db.otpChallenges.find(c => c.id === otpChallengeId && c.mobile === mobile);
  if (!challenge || challenge.purpose !== 'password_recovery' || !challenge.consumedAt) {
      return res.status(400).json({ success: false, error: 'فرآیند تایید هویت با کد یکبار مصرف کامل نشده است.' });
  }

  if (newPassword.trim().length < 6) {
    return res.status(400).json({ success: false, error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
  }

  const user = db.users.find((u) => u.mobile === mobile);
  if (!user) {
    return res.status(404).json({ success: false, error: 'کاربری یافت نشد.' });
  }

  user.password = bcrypt.hashSync(newPassword.trim(), 10);
  failedLogins.delete(mobile);

  db.auditLogs.push({
    id: \`log-\${Date.now()}\`,
    adminId: user.id,
    action: 'PASSWORD_RECOVERED',
    entityType: 'USER',
    entityId: user.id,
    details: \`رمز عبور کاربر \${user.mobile} با OTP بازیابی شد.\`,
    createdAt: new Date().toISOString(),
  });
  db.save();

  res.json({ success: true, message: 'رمز عبور شما با موفقیت بازنشانی شد.' });
});
`;

content = content.replace(/authRouter\.post\('\/recover-password', validate\(recoverPasswordSchema\), \(req, res\) => \{[\s\S]*?\}\);/, replace);

fs.writeFileSync(authPath, content, 'utf-8');
console.log('Fixed password recovery to use OTP');
