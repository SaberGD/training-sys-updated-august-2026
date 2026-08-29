/**
 * Firebase Cloud Functions Backend for Saber Group TMS
 * Production-ready Google OAuth 2.0 Integration & Account Management
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const ALGORITHM = "aes-256-cbc";
const corsHandler = cors({ origin: true, credentials: true });

const DEFAULT_GOOGLE_CLIENT_ID = "713765974154-thn039cs640kj45t661idkgeq0o3m3ik.apps.googleusercontent.com";
const DEFAULT_GOOGLE_CLIENT_SECRET = "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";
const DEFAULT_ENCRYPTION_KEY = "522d0c9e1739b49296ec0583249a757b5cb580acfa8115675ce1f2bf5a395eb9";

/**
 * Get SHA-256 derived Encryption Key from secret or environment
 */
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY;
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt sensitive Refresh Tokens before saving to Firestore
 */
function encryptToken(text) {
  if (!text) return "";
  try {
    const iv = crypto.randomBytes(16);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
  } catch (err) {
    console.error("Token encryption error:", err);
    return text;
  }
}

/**
 * Decrypt Refresh Tokens retrieved from Firestore
 */
function decryptToken(encryptedText) {
  if (!encryptedText) return "";
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Token decryption error:", err);
    return "";
  }
}

/**
 * Build OAuth2 Client with dynamic or configured Redirect URI
 */
function getOAuth2Client(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || DEFAULT_GOOGLE_CLIENT_SECRET;

  let redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri && req) {
    const rawProto = (req.headers && req.headers['x-forwarded-proto']) || req.protocol || 'https';
    const firstProto = String(rawProto).split(',')[0].trim();
    const host = (req.headers && req.headers['x-forwarded-host']) || req.get("host") || "";
    const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const protocol = isLocal ? (firstProto.includes('https') ? 'https' : 'http') : 'https';

    const path = req.originalUrl || req.url || "";
    if (path.includes("/api/")) {
      redirectUri = `${protocol}://${host}/api/google/callback`;
    } else {
      redirectUri = `${protocol}://${host}/googleOAuthCallback`;
    }
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Helper to retrieve OAuth Client for a Trainer or Admin
 */
async function getTrainerOAuthClient(req, preferredEmail, trainerId) {
  let snap = null;

  // 1. Check Trainer ID
  if (trainerId) {
    const trainerDocRef = db.collection("googleConnections").doc(`trainer_${trainerId}`);
    const trainerSnap = await trainerDocRef.get();
    if (trainerSnap.exists && trainerSnap.data()?.status === "connected") {
      snap = trainerSnap;
    } else {
      const qTrainer = await db.collection("googleConnections")
        .where("trainerId", "==", trainerId)
        .where("status", "==", "connected")
        .get();
      if (!qTrainer.empty) {
        snap = qTrainer.docs[0];
      }
    }
  }

  // 2. Check Preferred Email
  if ((!snap || !snap.exists) && preferredEmail) {
    const docId = preferredEmail.replace(/[^a-z0-9_]/g, "_");
    const docRef = db.collection("googleConnections").doc(docId);
    const docSnap = await docRef.get();
    if (docSnap.exists && docSnap.data()?.status === "connected") {
      snap = docSnap;
    }
  }

  // 3. Fallback to any connected organizer
  if (!snap || !snap.exists) {
    const qConnected = await db.collection("googleConnections")
      .where("status", "==", "connected")
      .get();
    if (!qConnected.empty) {
      snap = qConnected.docs[0];
    }
  }

  // 4. Fallback to Central Admin Account
  if (!snap || !snap.exists) {
    const centralRef = db.collection("googleConnections").doc("sabergroup_eg_gmail_com");
    const centralSnap = await centralRef.get();
    if (centralSnap.exists && centralSnap.data()?.status === "connected") {
      snap = centralSnap;
    }
  }

  if (!snap || !snap.exists || snap.data()?.status !== "connected") {
    throw new Error("لا يوجد حساب Google متصل لهذا المدرب أو للمؤسسة. يرجى ربط حساب Google للمدرب أولاً.");
  }

  const data = snap.data();
  const refreshToken = decryptToken(data.encryptedRefreshToken);
  if (!refreshToken) {
    throw new Error(`توكن الحساب (${data.googleEmail || data.email}) غير صالح أو متعذر فك تشفيره.`);
  }

  const oauth2Client = getOAuth2Client(req);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return {
    oauth2Client,
    email: data.googleEmail || data.email,
    displayName: data.displayName || "",
    connectionId: snap.id
  };
}

/**
 * Helper to retrieve Central OAuth Client for sending emails
 */
async function getCentralOAuthClient(req) {
  const docId = "sabergroup_eg_gmail_com";
  const centralDocRef = db.collection("googleConnections").doc(docId);
  let snap = await centralDocRef.get();

  if (!snap.exists) {
    const q = await db.collection("googleConnections")
      .where("type", "==", "central")
      .where("status", "==", "connected")
      .get();
    if (!q.empty) {
      snap = q.docs[0];
    }
  }

  if (!snap.exists) {
    const q = await db.collection("googleConnections")
      .where("status", "==", "connected")
      .get();
    if (!q.empty) {
      snap = q.docs[0];
    }
  }

  if (!snap.exists) {
    throw new Error("لم يتم ربط حساب Google بالنظام بعد. يرجى الدخول لصفحة Google Integrations والضغط على Connect Google Account.");
  }

  const data = snap.data();
  if (data.status !== "connected" || !data.encryptedRefreshToken) {
    throw new Error("الحساب الرسمي للنظام (sabergroup.eg@gmail.com) بحاجة لإعادة الاتصال (Reconnect Required).");
  }

  const refreshToken = decryptToken(data.encryptedRefreshToken);
  if (!refreshToken) {
    throw new Error("تعذر فك تشفير توكن الحساب الرسمي للنظام.");
  }

  const oauth2Client = getOAuth2Client(req);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return { oauth2Client, email: data.email || "sabergroup.eg@gmail.com" };
}

function buildEmailTemplate(template, data) {
  const studentName = data.studentName || 'المتدرب العزيز';
  const courseName = data.courseName || 'الكورس التدريبي';
  const groupCode = data.groupCode || data.groupId || 'الجروب التدريبي';
  const batchCode = data.batchCode || groupCode;
  const trainerName = data.trainerName || 'م. صابر عبد الدايم';
  const sessionNumber = data.sessionNumber || 1;
  const date = data.date || 'اليوم';
  const time = data.time || 'في الموعد المحدد';
  const studentPortalUrl = 'https://training.sabergroupacademy.com/#/student/portal';

  let subject = '';
  let content = '';

  if (data.customSubject && (data.customHtml || data.customContent || data.bodyHtml)) {
    subject = data.customSubject;
    content = data.customHtml || data.customContent || data.bodyHtml;

    const vars = {
      '{student_name}': studentName,
      '{course_name}': courseName,
      '{group_name}': groupCode,
      '{group_code}': groupCode,
      '{batch_code}': batchCode,
      '{student_id}': data.studentIdNum || data.studentId || '',
      '{student_password}': data.studentPassword || '',
      '{session_number}': String(sessionNumber),
      '{lecture_title}': data.lectureTitle || `المحاضرة رقم ${sessionNumber}`,
      '{old_date}': data.oldDate || data.old_date || 'الموعد السابق',
      '{new_date}': date,
      '{session_date}': date,
      '{session_time}': time,
      '{trainer_name}': trainerName,
      '{meet_link}': data.meetLink || 'https://meet.google.com',
      '{portal_link}': studentPortalUrl,
      '{reason}': data.reason || 'تحديث جدول المحاضرات',
      '{announcement_content}': (data.announcementContent || data.announcement_content || data.message || '').replace(/\n/g, '<br/>')
    };

    for (const [key, val] of Object.entries(vars)) {
      subject = subject.replaceAll(key, val);
      content = content.replaceAll(key, val);
    }
  } else {
    switch (template) {
      case 'welcome':
      case 'welcome_group':
        subject = `مرحباً بك في ${groupCode} - ${courseName} | SABER GROUP COURSES ACADEMY`;
        content = `
          <div dir="rtl" style="font-family: Arial, sans-serif; color: #1e293b; padding: 24px; background-color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #059669; margin: 0 0 6px 0; font-size: 20px;">مرحباً بك في أسرّتنا التدريبية 🎉</h2>
              <p style="color: #64748b; font-size: 13px; margin: 0; font-weight: bold; letter-spacing: 0.5px;">SABER GROUP COURSES ACADEMY</p>
            </div>

            <p style="font-size: 15px;">عزيزي الطالب <strong>${studentName}</strong>،</p>
            <p style="font-size: 14px; line-height: 1.6;">يسعدنا انضمامك إلى كورس <strong>${courseName}</strong> - جروب <strong>${groupCode}</strong>.</p>
            
            <div style="background-color: #ffffff; padding: 18px; border-radius: 12px; border-right: 4px solid #059669; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #059669;">بيانات تسجيل الدخول إلى بوابة الطالب:</h3>
              <p style="margin: 6px 0; font-size: 13px;"><strong>الـ ID الخاص بك:</strong> <code style="background-color: #f1f5f9; padding: 3px 8px; border-radius: 6px; color: #0f172a; font-weight: bold;">${data.studentIdNum || ''}</code></p>
              <p style="margin: 6px 0; font-size: 13px;"><strong>كلمة السر:</strong> <code style="background-color: #f1f5f9; padding: 3px 8px; border-radius: 6px; color: #0f172a; font-weight: bold;">${data.studentPassword || ''}</code></p>
            </div>

            <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px;">
              <p style="margin: 0; font-size: 12px; color: #e11d48; font-weight: bold; line-height: 1.5;">
                ⚠️ تنبيه أمني هام: برجاء عدم مشاركة الـ ID أو كلمة السر الخاصة بك مع أي شخص إطلاقاً لضمان أمان حسابك وسجلك التدريبي.
              </p>
            </div>

            <div style="background-color: #f1f5f9; padding: 14px; border-radius: 10px; margin-bottom: 20px;">
              <p style="margin: 4px 0; font-size: 13px;"><strong>كود الدفعة:</strong> ${batchCode}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>المدرب الأساسي:</strong> ${trainerName}</p>
            </div>

            <p style="font-size: 13px; line-height: 1.5;">يمكنك متابعة المحاضرات، تسجيل الحضور، وتحميل الملفات من خلال بوابة الطالب الرسمية.</p>

            <div style="text-align: center; margin-top: 22px; margin-bottom: 24px;">
              <a href="${studentPortalUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px;">الانتقال لبوابة الطالب</a>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">All rights are reserved to Eng. Mohamed Saber©</p>
          </div>
        `;
        break;

    case 'session_reminder':
      subject = `تذكير بموعد المحاضرة ${sessionNumber} - كورس ${courseName} | SABER GROUP`;
      content = `
        <h2 style="color: #2563eb; margin-top: 0;">تذكير بموعد المحاضرة القادمة ⏰</h2>
        <p>أهلاً ${studentName}، نود تذكيرك بموعد المحاضرة رقم <strong>(${sessionNumber})</strong> لكورس <strong>${courseName}</strong> (مجموعة ${groupCode}).</p>
        <div style="background-color: #f1f5f9; border-right: 4px solid #2563eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>📅 التاريخ:</strong> ${date}</p>
          <p style="margin: 5px 0;"><strong>⏰ الموعد:</strong> ${time}</p>
        </div>
        <p>يرجى التواجد قبل الموعد بـ 5 دقائق للتحضير.</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${studentPortalUrl}" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">الانضمام للمحاضرة عبر البوابة</a>
        </div>
      `;
      break;

    case 'weekly_report':
      subject = `التقرير الأسبوعي لمتابعة الأداء | كورس ${courseName}`;
      content = `
        <h2 style="color: #059669; margin-top: 0;">التقرير الأسبوعي للأداء 📊</h2>
        <p>عزيزي الطالب <strong>${studentName}</strong>،</p>
        <p>إليك ملخص التقرير الأسبوعي لمتابعة أدائك وحضورك وتكليفاتك بالجروب <strong>${groupCode}</strong> بكورس <strong>${courseName}</strong> حتى تاريخ ${date}.</p>
        <p>يمكنك الاطلاع على تفاصيل التقييم وملاحظات المدرب عبر بوابة الطالب:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${studentPortalUrl}" style="background-color: #059669; color: white; padding: 10px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">فتح التقرير التفصيلي من البوابة</a>
        </div>
      `;
      break;

    case 'trainer_announcement':
      subject = `📢 تنويه هام من المدرب ${trainerName} - ${courseName} | ${groupCode}`;
      content = `
        <div dir="rtl" style="font-family: Arial, sans-serif; color: #1e293b; padding: 24px; background-color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 14px;">
            <h2 style="color: #1d4ed8; margin: 0 0 6px 0; font-size: 20px;">📢 رسالة إعلانية هامة من مدرب الجروب</h2>
            <p style="color: #64748b; font-size: 13px; margin: 0; font-weight: bold;">${courseName} - ${groupCode}</p>
          </div>

          <p style="font-size: 15px;">عزيزي الطالب <strong>${studentName}</strong>،</p>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">تحية طيبة وبعد،،</p>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">نود إفادتكم بالتالي من قِبل مدرب الكورس:</p>

          <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border-right: 4px solid #2563eb; margin: 18px 0; box-shadow: 0 1px 4px rgba(0,0,0,0.06); line-height: 1.7; font-size: 14px; color: #0f172a;">
            ${(data.announcementContent || data.announcement_content || data.message || '').replace(/\n/g, '<br/>')}
          </div>

          <div style="background-color: #eff6ff; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #bfdbfe;">
            <p style="margin: 2px 0; font-size: 13px; color: #1e40af;"><strong>المدرب المسؤول:</strong> ${trainerName}</p>
            <p style="margin: 2px 0; font-size: 13px; color: #1e40af;"><strong>كود الدفعة / الجروب:</strong> ${batchCode}</p>
          </div>

          <p style="font-size: 13px; line-height: 1.5; color: #475569;">يرجى متابعة التكليفات واللوائح عبر بوابة الطالب الرسمية الخاصة بك.</p>

          <div style="text-align: center; margin-top: 22px; margin-bottom: 24px;">
            <a href="${studentPortalUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 14px;">الانتقال إلى بوابة الطالب</a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">All rights reserved to Eng. Mohamed Saber© - SABER GROUP COURSES ACADEMY</p>
        </div>
      `;
      break;

    case 'test':
    default:
      subject = `إيميل تجريبي لاختبار ربط النظام | SABER GROUP`;
      content = `
        <h2 style="color: #4f46e5; margin-top: 0;">اختبار نظام الإيميلات الرسمي 🚀</h2>
        <p>مرحباً بك! هذا إيميل تجريبي أرسل تلقائياً من نظام SABER GROUP عبر الحساب الرسمي المعتمد:</p>
        <p style="font-family: monospace; font-weight: bold; color: #16a34a; font-size: 1.1rem;">sabergroup.eg@gmail.com</p>
        <p>يعمل نظام إرسال الرسائل والقوالب المعتمدة عبر Gmail API بشكل سليم ومستقر!</p>
      `;
      break;
    }
  }

  const trimmedContent = content.trim();
  let html = trimmedContent;
  if (!trimmedContent.startsWith('<div') && !trimmedContent.startsWith('<!DOCTYPE') && !trimmedContent.startsWith('<html')) {
    html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; text-align: right; }
          .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        </style>
      </head>
      <body>
        <div class="wrapper">
          ${content}
        </div>
      </body>
      </html>
    `;
  }

  return { subject, html };
}

async function sendGmailMessage(oauth2Client, fromEmail, toEmail, subject, htmlBody) {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `From: SABER GROUP <${fromEmail}>`,
    `To: ${toEmail}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    `Subject: ${utf8Subject}`,
    ``,
    htmlBody
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });
  return res.data;
}

async function handleSendEmail(req, res) {
  let recipientEmail = '';
  let template = 'welcome';
  try {
    const body = req.body || {};
    recipientEmail = (body.recipientEmail || '').trim();
    template = body.template || 'welcome';

    if (!recipientEmail) {
      return res.status(400).json({ error: "البريد الإلكتروني للمستلم مطلوب (recipientEmail is required)." });
    }

    const { oauth2Client, email: fromEmail } = await getCentralOAuthClient(req);

    // Try looking up dynamic template from Firestore 'emailTemplates' collection
    let customSubject = body.customSubject;
    let customHtml = body.customHtml || body.customContent || body.bodyHtml;

    if (!customSubject || !customHtml) {
      try {
        let tSnap = await db.collection("emailTemplates").doc(template).get();
        if (!tSnap.exists && template === 'welcome_group') {
          tSnap = await db.collection("emailTemplates").doc("welcome").get();
        } else if (!tSnap.exists && template === 'welcome') {
          tSnap = await db.collection("emailTemplates").doc("welcome_group").get();
        }

        if (tSnap.exists) {
          const tData = tSnap.data();
          if (tData?.subject) customSubject = tData.subject;
          if (tData?.bodyHtml || tData?.content || tData?.body) {
            customHtml = tData.bodyHtml || tData.content || tData.body;
          }
        }
      } catch (e) {
        console.warn("Could not fetch email template from Firestore:", e);
      }
    }

    const { subject, html } = buildEmailTemplate(template, {
      ...body,
      customSubject,
      customHtml
    });

    await sendGmailMessage(oauth2Client, fromEmail, recipientEmail, subject, html);

    const logData = {
      recipientEmail,
      studentName: body.studentName || '',
      groupId: body.groupId || '',
      groupCode: body.groupCode || '',
      courseName: body.courseName || '',
      template,
      status: 'sent',
      sentAt: new Date().toISOString(),
      error: ''
    };

    await db.collection("emailLogs").add(logData);

    res.json({ success: true, message: `تم إرسال إيميل (${template}) بنجاح إلى ${recipientEmail}`, log: logData });
  } catch (err) {
    console.error("Error sending email:", err);
    const errorMsg = err.message || 'فشل إرسال الإيميل';

    if (recipientEmail) {
      try {
        await db.collection("emailLogs").add({
          recipientEmail,
          studentName: req.body?.studentName || '',
          groupId: req.body?.groupId || '',
          template,
          status: 'failed',
          sentAt: new Date().toISOString(),
          error: errorMsg
        });
      } catch (e) {
        console.error("Failed to log error to emailLogs:", e);
      }
    }

    res.status(500).json({ error: errorMsg });
  }
}

async function handleSendTestEmail(req, res) {
  try {
    const { recipientEmail } = req.body || {};
    const { oauth2Client, email: fromEmail } = await getCentralOAuthClient(req);
    const targetEmail = recipientEmail || fromEmail || 'sabergroup.eg@gmail.com';

    const { subject, html } = buildEmailTemplate('test', {});
    await sendGmailMessage(oauth2Client, fromEmail, targetEmail, subject, html);

    const logData = {
      recipientEmail: targetEmail,
      studentName: 'مسؤول النظام',
      template: 'test',
      status: 'sent',
      sentAt: new Date().toISOString(),
      error: ''
    };

    await db.collection("emailLogs").add(logData);

    res.json({ success: true, message: `تم إرسال إيميل تجريبي بنجاح إلى ${targetEmail}!`, log: logData });
  } catch (err) {
    console.error("Error sending test email:", err);
    res.status(500).json({ error: err.message || 'فشل إرسال الإيميل التجريبي' });
  }
}

async function handleRecordAuditLog(req, res) {
  try {
    const logData = req.body;
    await recordGoogleAuditLog(logData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "فشل تسجيل الـ Audit Log" });
  }
}

async function handleGemyChat(req, res) {
  try {
    const { message, history, studentContext, staffContext } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "نص الرسالة (message) مطلوب." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) {
      return res.status(500).json({ error: "مفتاح API الخاص بـ Gemini غير معرف في بيئة العمل (GEMINI_API_KEY missing)." });
    }

    let systemPrompt = `أنت "GEMY" (جيمي) المساعد الذكي التفاعلي الرسمي لأكاديمية Saber Group للتطوير البرمجي والتقني.
أنت خبير بالنظام وتجيب باختصار ودقة وودية واحترافية باللغة العربية.
`;

    if (staffContext) {
      systemPrompt += `المستخدم الحالي موظف/مدرب بالنظام بالبيانات التالية:
- الاسم: ${staffContext.name || 'غير محدد'}
- البريد: ${staffContext.email || 'N/A'}
- الدور/الوظيفة: ${staffContext.role || 'موظف'}
`;
    } else if (studentContext) {
      systemPrompt += `المستخدم الحالي متدرب مسجل بالبيانات الرسمية التالية:
- الاسم: ${studentContext.name || 'غير محدد'}
- كود الطالب (ID): ${studentContext.studentIdNum || studentContext.id || 'N/A'}
- الجروب: ${studentContext.groupName || 'غير محدد'}
- الكورس/المسار: ${studentContext.courseName || 'غير محدد'}
- حالة القيد: ${studentContext.status === 'active' ? 'نشط ومستمر ✅' : 'مكتمل / خريج'}
- نسبة الحضور: حضر (${studentContext.attendedCount || 0}) من إجمالي (${studentContext.totalSessions || 0}) محاضرة (نسبة الحضور: ${studentContext.attendanceRate || 0}%).
- الواجبات ونقاط التميز: نقاط التميز (${studentContext.totalPoints || 0})، الجزاءات (${studentContext.totalPenalties || 0}).
- الموقف المالي: الرسوم المستحقة (${studentContext.totalCourseFee || 0} ج.م)، المسدد (${studentContext.paidAmount || 0} ج.م)، المتبقي المستحق (${studentContext.remainingBalance || 0} ج.م) ${studentContext.remainingBalance > 0 ? '⚠️ يوجد متبقي رسوم' : 'مسدد بالكامل ✅'}.
- المحاضرة القادمة: ${studentContext.nextSessionDate ? `بتاريخ ${studentContext.nextSessionDate} ${studentContext.nextSessionTime || ''}` : 'لا توجد مواعيد جديدة مضافة حالياً'}.
- رابط المحاضرة: ${studentContext.googleMeetUrl || 'يظهر بالبوابة قبل بدء المحاضرة'}.

عندما يسألك الطالب عن بياناته (الغياب، المواعيد، الرسوم، النقاط)، أجب فوراً وبدقة مستخدماً الأرقام الموضحة أعلاه.
`;
    } else {
      systemPrompt += `المستخدم زائر أو طالب غير مسجل الدخول (Public Visitor Mode).
معلومات عن Saber Group Academy:
- أكاديمية صابر جروب تقدم مسارات احترافية في: Web Development (React & Node.js), Mobile Apps (Flutter & React Native), AI & Python, UI/UX Design, Cyber Security.
- المزايا: تطبيق عملي 100%، مشاريع تخرج، شهادات معتمدة، متابعة فردية.
أجب عن الأسئلة العامة حول الكورسات والتسجيل بحب ورحابة. إذا سأل الزائر عن درجاته أو غيابه، اطلب منه تسجيل الدخول باستخدام رقم الـ ID وكلمة السر.
`;
    }

    const contents = [
      { role: "user", parts: [{ text: `System Context:\n${systemPrompt}` }] },
      { role: "model", parts: [{ text: "أهلاً بك! أنا جيمي جاهز لمساعدتك في كل ما يتعلق بـ Saber Group. كيف أساعدك اليوم؟ 🤖" }] }
    ];

    if (history && Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        if (item.role && item.parts && item.parts.length > 0) {
          contents.push({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: item.parts[0].text || '' }]
          });
        }
      }
    }

    contents.push({ role: "user", parts: [{ text: message }] });

    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    let replyText = "";
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents })
        });

        if (response.ok) {
          const data = await response.json();
          replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (replyText) break;
        } else {
          const errData = await response.text();
          console.warn(`Gemini model ${modelName} returned status ${response.status}:`, errData);
        }
      } catch (e) {
        lastError = e;
        console.warn(`Error calling Gemini model ${modelName}:`, e.message);
      }
    }

    if (!replyText) {
      return res.status(500).json({ error: lastError?.message || "فشل الاتصال بنماذج الذكاء الاصطناعي حالياً." });
    }

    res.json({ reply: replyText });

  } catch (err) {
    console.error("handleGemyChat error:", err);
    res.status(500).json({ error: err.message || "حدث خطأ في محادثة جيمي الذكي." });
  }
}

/**
 * Record Google Audit Log
 */
async function recordGoogleAuditLog(data) {
  try {
    await db.collection("googleAuditLogs").add({
      ...data,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("Failed to write googleAuditLog:", e);
  }
}

// =========================================================================
// HANDLERS FOR FUNCTIONS & EXPRESS API
// =========================================================================

async function handleGoogleOAuthStart(req, res) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || DEFAULT_GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: "لم يتم تعيين GOOGLE_CLIENT_ID أو GOOGLE_CLIENT_SECRET في بيئة Firebase Functions Secrets."
      });
    }

    const accountType = req.query.accountType || req.query.type || "trainer";
    const trainerId = req.query.trainerId || "";
    const userId = req.query.userId || "";

    const oauth2Client = getOAuth2Client(req);

    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ];

    const statePayload = JSON.stringify({
      accountType,
      trainerId,
      userId,
      returnUrl: req.query.returnUrl || ""
    });

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      state: statePayload
    });

    if (req.query.json === "true") {
      return res.json({ url });
    }

    return res.redirect(url);
  } catch (err) {
    console.error("googleOAuthStart Error:", err);
    return res.status(500).json({ error: err.message });
  }
}

async function handleGoogleOAuthCallback(req, res) {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head><meta charset="UTF-8"><title>خطأ في مصادقة Google</title></head>
        <body style="font-family:sans-serif;background:#0f172a;color:white;text-align:center;padding:50px;">
          <h2 style="color:#ef4444;">⚠️ فشل الاتصال بـ Google</h2>
          <p>${error}</p>
        </body>
        </html>
      `);
    }

    if (!code) {
      return res.status(400).send("لم يتم استقبال كود التفويض (code)");
    }

    let stateData = {};
    if (state) {
      try { stateData = JSON.parse(state); } catch (e) {}
    }

    const oauth2Client = getOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = (userInfo.data.email || "").toLowerCase().trim();
    const displayName = userInfo.data.name || googleEmail.split("@")[0];

    const trainerId = stateData.trainerId || "";
    const userId = stateData.userId || "";
    const accountType = stateData.accountType || (googleEmail === "sabergroup.eg@gmail.com" ? "admin" : "trainer");

    const docId = trainerId ? `trainer_${trainerId}` : googleEmail.replace(/[^a-z0-9_]/g, "_");
    const connRef = db.collection("googleConnections").doc(docId);
    const existingSnap = await connRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;

    let encryptedRefreshToken = "";
    if (tokens.refresh_token) {
      encryptedRefreshToken = encryptToken(tokens.refresh_token);
    } else if (existingData && existingData.encryptedRefreshToken) {
      encryptedRefreshToken = existingData.encryptedRefreshToken;
    }

    const nowIso = new Date().toISOString();
    const connectionPayload = {
      id: docId,
      userId: userId || existingData?.userId || "",
      trainerId: trainerId || existingData?.trainerId || "",
      googleEmail: googleEmail,
      email: googleEmail,
      displayName: displayName,
      accountType: accountType,
      type: accountType === "admin" ? "central" : "organizer",
      status: "connected",
      encryptedRefreshToken,
      accessTokenExpiry: tokens.expiry_date || null,
      lastConnectedAt: nowIso,
      createdAt: existingData?.createdAt || nowIso,
      updatedAt: nowIso
    };

    await connRef.set(connectionPayload, { merge: true });

    const clientAppUrl = process.env.CLIENT_APP_URL || "https://sg-tms-v2.firebaseapp.com";
    const defaultRoute = accountType === "trainer" ? "trainer/google-connect" : "google-integrations";
    const redirectTarget = stateData.returnUrl || `${clientAppUrl}/#/${defaultRoute}?success=true&email=${encodeURIComponent(googleEmail)}`;

    return res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>تم الربط بنجاح</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1.25rem; border: 1px solid #10b981; text-align: center; max-width: 450px; }
          h2 { color: #34d399; margin-top: 0; }
          p { color: #cbd5e1; }
          .email { color: #60a5fa; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✅ تم ربط حساب Google بنجاح</h2>
          <p>الحساب: <span class="email">${googleEmail}</span></p>
          <p>نوع الربط: ${accountType === "admin" ? "الحساب الرسمي للنظام" : "حساب مدرب (Trainer Connection)"}</p>
          <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 1.5rem;">جاري إعادة توجيهك إلى النظام...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', email: '${googleEmail}' }, '*');
            setTimeout(() => window.close(), 1500);
          } else {
            setTimeout(() => { window.location.href = "${redirectTarget}"; }, 1800);
          }
        </script>
      </body>
      </html>
    `);

  } catch (err) {
    console.error("googleOAuthCallback Error:", err);
    return res.status(500).send(`فشل ربط الحساب: ${err.message}`);
  }
}

async function handleSyncGroupCalendar(req, res) {
  try {
    const { groupId, organizerEmail, forceRetryOnly } = req.body || {};
    if (!groupId) {
      return res.status(400).json({ error: "معرف الجروب (groupId) مطلوب." });
    }

    const groupSnap = await db.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) {
      return res.status(404).json({ error: "الجروب المطلوب غير موجود." });
    }
    const group = groupSnap.data();

    const primaryTrainerId = group.primaryTrainerId || (group.trainerIds && group.trainerIds[0]) || group.supervisorId;
    const { oauth2Client, email: organizerAccountEmail, connectionId: googleConnectionId } = await getTrainerOAuthClient(req, organizerEmail, primaryTrainerId);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const baseStaffAttendees = [];
    const trainerIds = group.trainerIds || [];
    if (group.primaryTrainerId && !trainerIds.includes(group.primaryTrainerId)) trainerIds.push(group.primaryTrainerId);
    if (group.secondaryTrainerId && !trainerIds.includes(group.secondaryTrainerId)) trainerIds.push(group.secondaryTrainerId);

    for (const tId of trainerIds) {
      try {
        const tSnap = await db.collection("users").doc(tId).get();
        if (tSnap.exists && tSnap.data().email) {
          baseStaffAttendees.push({ email: tSnap.data().email, displayName: tSnap.data().name });
        }
      } catch (e) {
        console.warn("Could not fetch trainer email:", tId);
      }
    }

    if (group.supervisorId) {
      try {
        const sSnap = await db.collection("users").doc(group.supervisorId).get();
        if (sSnap.exists && sSnap.data().email) {
          baseStaffAttendees.push({ email: sSnap.data().email, displayName: sSnap.data().name });
        }
      } catch (e) {
        console.warn("Could not fetch supervisor email:", group.supervisorId);
      }
    }

    const studentsSnap = await db.collection("students").where("groupId", "==", groupId).get();
    const groupStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validStudentAttendees = [];
    const missingAttendanceEmails = [];

    for (const st of groupStudents) {
      const studentEmail = (st.attendanceEmail || st.email || "").trim().toLowerCase();
      if (studentEmail && emailRegex.test(studentEmail)) {
        if (!validStudentAttendees.some(a => a.email.toLowerCase() === studentEmail)) {
          validStudentAttendees.push({
            email: studentEmail,
            displayName: st.name || "طالب"
          });
        }
      } else {
        missingAttendanceEmails.push({
          id: st.id,
          name: st.name || "طالب",
          phone: st.phone || "",
          studentIdNum: st.studentIdNum || ""
        });
      }
    }

    const sessionsSnap = await db.collection("sessions").where("groupId", "==", groupId).get();
    const allSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (allSessions.length === 0) {
      return res.json({ 
        success: true, 
        total: 0, 
        succeeded: 0, 
        failed: 0, 
        missingAttendanceEmails,
        message: "لا يوجد محاضرة مجدولة لهذا الجروب حالياً." 
      });
    }

    let sessionsToSync = allSessions;
    if (forceRetryOnly) {
      sessionsToSync = allSessions.filter((s) => s.googleSyncStatus === "failed" || !s.googleCalendarEventId);
    }

    let succeededCount = 0;
    let failedCount = 0;
    const syncResults = [];

    for (const session of sessionsToSync) {
      try {
        const dateStr = session.date || new Date().toISOString().split("T")[0];
        let timeStr = group.sessionTime || "18:00";
        let startHHMM = "18:00";
        let endHHMM = "20:00";

        const timeMatches = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (timeMatches) {
          let hour = parseInt(timeMatches[1], 10);
          const min = timeMatches[2];
          if (timeStr.toLowerCase().includes("pm") && hour < 12) hour += 12;
          startHHMM = `${hour.toString().padStart(2, "0")}:${min}`;
          const endHour = (hour + 2) % 24;
          endHHMM = `${endHour.toString().padStart(2, "0")}:${min}`;
        }

        const inviteStudentsToCalendar = req.body?.inviteStudentsToCalendar === true || group.inviteStudentsToCalendar === true;
        let includeStudents = inviteStudentsToCalendar;

        const sessionAttendees = [...baseStaffAttendees];
        if (includeStudents && validStudentAttendees.length > 0) {
          for (const stAtt of validStudentAttendees) {
            if (!sessionAttendees.some(a => a.email.toLowerCase() === stAtt.email.toLowerCase())) {
              sessionAttendees.push(stAtt);
            }
          }
        }

        const batchCode = group.batchCode || group.name || "Group";
        const sessionNum = session.sessionNumber || 1;
        const lectureTitle = session.lectureTitle || `المحاضرة ${sessionNum}`;
        const trainerName = session.actualTrainerName || group.trainerName || group.primaryTrainerName || "غير محدد";
        const rescheduleNote = session.dateChangeReason ? `\nملاحظة التعديل / الترحيل: ${session.dateChangeReason}` : "";

        const eventTitle = `${batchCode} - المحاضرة ${sessionNum} - ${lectureTitle}`;
        const description = `SABER GROUP Training Management System\nالكورس: ${group.courseName || ''}\nالجروب: ${batchCode}\nالمحاضرة رقم: ${sessionNum}\nالمدرب: ${trainerName}\nرابط بوابة الطالب: https://training.sabergroupacademy.com/#/student-portal${rescheduleNote}`;

        const isOfflineGroup = group.groupType === 'offline';
        const isSessionDone = session.status === 'done';

        const eventPayload = {
          summary: eventTitle,
          description,
          location: isOfflineGroup ? "مقر الأكاديمية (أوفلاين)" : undefined,
          start: {
            dateTime: `${dateStr}T${startHHMM}:00`,
            timeZone: "Africa/Cairo"
          },
          end: {
            dateTime: `${dateStr}T${endHHMM}:00`,
            timeZone: "Africa/Cairo"
          },
          attendees: sessionAttendees.length > 0 ? sessionAttendees : undefined
        };

        // Only create Google Meet link for upcoming sessions (not completed/done)
        if (!isSessionDone && (!isOfflineGroup || req.body?.createMeet === true || session.googleMeetUrl || session.meetingLink)) {
          eventPayload.conferenceData = {
            createRequest: {
              requestId: `meet_space_${session.id}_${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" }
            }
          };
        }

        const sendUpdatesMode = includeStudents ? "all" : "none";

        let calRes;
        if (session.googleCalendarEventId) {
          try {
            calRes = await calendar.events.update({
              calendarId: "primary",
              eventId: session.googleCalendarEventId,
              conferenceDataVersion: 1,
              sendUpdates: sendUpdatesMode,
              requestBody: eventPayload
            });
          } catch (updateErr) {
            calRes = await calendar.events.insert({
              calendarId: "primary",
              conferenceDataVersion: 1,
              sendUpdates: sendUpdatesMode,
              requestBody: eventPayload
            });
          }
        } else {
          calRes = await calendar.events.insert({
            calendarId: "primary",
            conferenceDataVersion: 1,
            sendUpdates: sendUpdatesMode,
            requestBody: eventPayload
          });
        }

        const eventId = calRes.data.id;
        const hangoutLink = calRes.data.hangoutLink || calRes.data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri || "";

        await db.collection("sessions").doc(session.id).update({
          googleCalendarEventId: eventId,
          googleMeetLink: hangoutLink,
          googleConnectionId: googleConnectionId || "",
          googleMeetUrl: hangoutLink,
          meetingLink: hangoutLink || session.meetingLink || "",
          googleSyncStatus: "synced",
          updatedAt: new Date().toISOString()
        });

        const isUpdate = !!session.googleCalendarEventId;
        await recordGoogleAuditLog({
          action: isUpdate ? "Calendar Updated" : "Calendar Created",
          operator: req.body?.operatorName || "System",
          operatorEmail: req.body?.operatorEmail || "",
          groupId,
          groupName: group.name,
          sessionId: session.id,
          sessionNumber: session.sessionNumber,
          details: `تم ${isUpdate ? "تحديث" : "إنشاء"} Google Calendar Event للمحاضرة رقم ${session.sessionNumber} (${session.lectureTitle || ""})`,
          status: "success"
        });

        succeededCount++;
        syncResults.push({ sessionId: session.id, status: "synced", eventId, hangoutLink });

      } catch (sessionErr) {
        console.error(`Error syncing session ${session.id}:`, sessionErr);
        failedCount++;
        try {
          await db.collection("sessions").doc(session.id).update({
            googleSyncStatus: "failed",
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to set session status to failed:", e);
        }

        await recordGoogleAuditLog({
          action: "Error",
          operator: req.body?.operatorName || "System",
          operatorEmail: req.body?.operatorEmail || "",
          groupId,
          groupName: group.name,
          sessionId: session.id,
          sessionNumber: session.sessionNumber,
          details: `فشل مزامنة Google Calendar للمحاضرة رقم ${session.sessionNumber}: ${sessionErr.message}`,
          status: "failed",
          error: sessionErr.message
        });

        syncResults.push({ sessionId: session.id, status: "failed", error: sessionErr.message || "Sync error" });
      }
    }

    res.json({
      success: true,
      total: sessionsToSync.length,
      succeeded: succeededCount,
      failed: failedCount,
      organizerAccount: organizerAccountEmail,
      missingAttendanceEmails,
      message: `تم تشغيل جدولة Google بنجاح: (${succeededCount}) نجح، (${failedCount}) فشل.`,
      details: syncResults
    });

  } catch (err) {
    console.error("Error syncing group calendar:", err);
    res.status(500).json({ error: err.message || "فشل مزامنة المواعيد مع Google Calendar" });
  }
}

async function handleDeleteGroupCalendar(req, res) {
  try {
    const { groupId } = req.body || {};
    if (!groupId) {
      return res.status(400).json({ error: "groupId is required" });
    }

    const groupSnap = await db.collection("groups").doc(groupId).get();
    const group = groupSnap.exists ? groupSnap.data() : null;

    const primaryTrainerId = group?.primaryTrainerId || (group?.trainerIds && group?.trainerIds[0]) || group?.supervisorId;
    const { oauth2Client } = await getOrganizerOAuthClient(req, undefined, primaryTrainerId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const sessionsSnap = await db.collection("sessions").where("groupId", "==", groupId).get();
    let deletedCount = 0;

    for (const sDoc of sessionsSnap.docs) {
      const s = sDoc.data();
      if (s.googleCalendarEventId) {
        try {
          await calendar.events.delete({
            calendarId: 'primary',
            eventId: s.googleCalendarEventId,
            sendUpdates: 'all'
          });
          deletedCount++;
        } catch (delErr) {
          console.warn(`Could not delete calendar event ${s.googleCalendarEventId}:`, delErr.message);
        }
        await db.collection("sessions").doc(sDoc.id).update({
          googleCalendarEventId: null,
          googleSyncStatus: 'pending',
          googleMeetUrl: null,
          meetingLink: null
        });
      }
    }

    res.json({
      success: true,
      deletedCount,
      message: `تم حذف (${deletedCount}) من أحداث الكالندر وإلغاؤها للجروب.`
    });
  } catch (err) {
    console.error("Error deleting group calendar events:", err);
    res.status(500).json({ error: err.message || "فشل حذف المواعيد من الكالندر" });
  }
}

async function handleUpdateSessionSchedule(req, res) {
  try {
    const { groupId, sessionId, newDate, newTime, organizerEmail, operatorName, operatorEmail, reason } = req.body || {};
    if (!groupId || !sessionId) {
      return res.status(400).json({ error: "معرف الجروب والمحاضرة مطلوبين." });
    }

    const groupSnap = await db.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) {
      return res.status(404).json({ error: "الجروب غير موجود." });
    }
    const group = groupSnap.data();

    const sessionSnap = await db.collection("sessions").doc(sessionId).get();
    if (!sessionSnap.exists) {
      return res.status(404).json({ error: "المحاضرة غير موجودة." });
    }
    const session = sessionSnap.data();

    const primaryTrainerId = group.primaryTrainerId || (group.trainerIds && group.trainerIds[0]) || group.supervisorId;
    const targetDate = newDate || session.date || new Date().toISOString().split("T")[0];
    const targetTime = newTime || group.sessionTime || "18:00";

    let startHHMM = "18:00";
    let endHHMM = "20:00";
    const timeMatches = targetTime.match(/(\d{1,2}):(\d{2})/);
    if (timeMatches) {
      let hour = parseInt(timeMatches[1], 10);
      const min = timeMatches[2];
      if (targetTime.toLowerCase().includes("pm") && hour < 12) hour += 12;
      startHHMM = `${hour.toString().padStart(2, "0")}:${min}`;
      const endHour = (hour + 2) % 24;
      endHHMM = `${endHour.toString().padStart(2, "0")}:${min}`;
    }

    let updatedMeetLink = session.googleMeetLink || session.googleMeetUrl || "";

    if (session.googleCalendarEventId) {
      try {
        const { oauth2Client } = await getTrainerOAuthClient(req, organizerEmail, primaryTrainerId);
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        const rescheduleNote = reason ? `\nسبب الترحيل/التحديث: ${reason}` : "";
        const batchCode = group.batchCode || group.name || "Group";
        const sessionNum = session.sessionNumber || 1;
        const lectureTitle = session.lectureTitle || `المحاضرة ${sessionNum}`;

        const updateRes = await calendar.events.patch({
          calendarId: "primary",
          eventId: session.googleCalendarEventId,
          sendUpdates: "none",
          requestBody: {
            summary: `${batchCode} - المحاضرة ${sessionNum} - ${lectureTitle} (مرحلة/محدثة)`,
            description: `SABER GROUP Training Management System\nالكورس: ${group.courseName || ''}\nتاريخ جديد: ${targetDate}${rescheduleNote}\nرابط بوابة الطالب: https://training.sabergroupacademy.com/#/student-portal`,
            start: { dateTime: `${targetDate}T${startHHMM}:00`, timeZone: "Africa/Cairo" },
            end: { dateTime: `${targetDate}T${endHHMM}:00`, timeZone: "Africa/Cairo" }
          }
        });
        updatedMeetLink = updateRes.data?.hangoutLink || updatedMeetLink;
      } catch (calErr) {
        console.warn("Could not update Google Calendar event directly:", calErr.message);
      }
    }

    await db.collection("sessions").doc(sessionId).update({
      date: targetDate,
      dateChangeReason: reason || session.dateChangeReason || "",
      googleSyncStatus: "synced",
      googleMeetLink: updatedMeetLink,
      googleMeetUrl: updatedMeetLink,
      updatedAt: new Date().toISOString()
    });

    await recordGoogleAuditLog({
      action: "Calendar Event Rescheduled",
      operator: operatorName || "System",
      operatorEmail: operatorEmail || "",
      groupId,
      groupName: group.name,
      sessionId,
      sessionNumber: session.sessionNumber,
      details: `تم ترحيل/تحديث موعد المحاضرة إلى ${targetDate} وتحديث Google Calendar. (${reason || "ترحيل المحاضرة"})`,
      status: "success"
    });

    res.json({ success: true, message: "تم ترحيل وتحديث موعد المحاضرة وGoogle Calendar بنجاح." });
  } catch (err) {
    console.error("Error rescheduling session event:", err);
    res.status(500).json({ error: err.message || "فشل ترحيل موعد المحاضرة" });
  }
}

/**
 * GEMY AI Assistant Handler for Cloud Functions / Firebase Hosting
 */
async function handleGemyChat(req, res) {
  try {
    const { message, history, studentContext, staffContext, courses } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: "الرسالة مطلوبة (message is required)." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || "";

    let systemPrompt = `أنت "GEMY" (جيمي)، المساعد الذكي التفاعلي الرسمي لأكاديمية Saber Group (صابر جروب للتدريب والتطوير البرمجي والتقني).
مهمتك الأساسية هي الإجابة عن استفسارات المستخدمين (طلاب، مدربين، كورديناتورز، وقيادات) بأسلوب عربي وودي، مشجع، محترف، وإيجابي، مع استخدام الإيموجي المناسب بشكل لطيف.
كن دائماً دقيقاً ومباشراً ومختصراً.

`;

    if (courses && Array.isArray(courses) && courses.length > 0) {
      systemPrompt += `الكورسات والمسارات المتاحة حالياً في الأكاديمية:\n${courses.map((c) => `- ${c.title || c.name || c} (${c.description || ''})`).join('\n')}\n\n`;
    }

    if (staffContext) {
      const roleTitles = {
        admin: 'المدير العام والنظام (Admin Master)',
        team_leader: 'قائد الفريق (Team Leader)',
        coordinator: 'منسق التدريب (Training Coordinator)',
        trainer: 'مدرب معتمد (Trainer)'
      };

      const currentRoleTitle = roleTitles[staffContext.role] || staffContext.role || 'عضو فريق العمل';

      systemPrompt += `المستخدم الحالي عضو في فريق عمل الأكاديمية (داخلي):
- الاسم: ${staffContext.name || 'غير محدد'}
- الدور / الوظيفة (Role): ${currentRoleTitle} (${staffContext.role})
- البريد الإلكتروني: ${staffContext.email || 'N/A'}
- حالة الحساب: ${staffContext.active ? 'نشط ✅' : 'موقوف'}

حدود الصلاحيات وقواعد الإجابة حسب Role المستخدم:
1. إذا كان المستخدم Admin: يمتلك كامل الصلاحيات في النظام.
2. إذا كان المستخدم Team Leader: يمتلك صلاحية متابعة أداء الجروبات والمدربين، مراجعة المحاضرات، وتقييم KPIs.
3. إذا كان المستخدم Coordinator: يمتلك صلاحيات إدارة الجروبات، التواصل مع الطلاب، الشكاوى، والمتابعات الدورية.
4. إذا كان المستخدم Trainer (مدرب): يمتلك صلاحية تسجيل حضور محاضرته، شرح بنود الـ Checklist، إضافة البريكات والتطبيقات، ومتابعة طلابه.
`;
    } else if (studentContext) {
      systemPrompt += `المستخدم الحالي متدرب مسجل ومسجل دخوله للبوابة بالبيانات الرسمية التالية:
- اسم المتدرب: ${studentContext.name || 'غير محدد'}
- كود/رقم الطالب (ID): ${studentContext.studentIdNum || studentContext.id || 'N/A'}
- اسم الجروب / المجموعة: ${studentContext.groupName || 'غير محدد'}
- اسم المسار / الكورس: ${studentContext.courseName || 'غير محدد'}
- حالة القيد: ${studentContext.status === 'active' ? 'نشط ومستمر في الدراسة ✅' : 'مكتمل / خريج'}
- نسبة الحضور: حضر (${studentContext.attendedCount || 0}) محاضرة من إجمالي (${studentContext.totalSessions || 0}) محاضرة تم تنفيذها (نسبة الحضور الحالية: ${studentContext.attendanceRate || '0'}%).
- الواجبات والتطبيق العملي: قام بتسليم (${studentContext.submittedEvaluationsCount || 0}) واجب/تطبيق، إجمالي نقاط التميز المكافأة: (${studentContext.totalPoints || 0}) نقطة، إجمالي الجزاءات/الخصم: (${studentContext.totalPenalties || 0}) نقطة.
- الموقف المالي: إجمالي المصاريف المستحقة (${studentContext.totalCourseFee || 0} ج.م)، المبلغ المسدد (${studentContext.paidAmount || 0} ج.م)، المتبقي المستحق (${studentContext.remainingBalance || 0} ج.م) ${studentContext.remainingBalance > 0 ? '⚠️ يوجد متبقي رسوم' : 'تم سداد الرسوم بالكامل ✅'}.
- المحاضرة القادمة: ${studentContext.nextSessionDate ? `بتاريخ ${studentContext.nextSessionDate} في تمام ${studentContext.nextSessionTime || ''}` : 'لا توجد مواعيد محاضرات جديدة مضافة حالياً'}.
- رابط المحاضرة الأونلاين (Meet / Zoom): ${studentContext.googleMeetUrl || 'رابط الحضور يظهر في جدول البوابة قبل بدء المحاضرة'}.

عندما يسألك المتدرب عن أي تفاصيل خاصة به (مثل: كم عدد غيابي؟ متى المحاضرة القادمة؟ هل علي واجب؟ ما هو موقفي المالي؟ كم عدد نقاطي؟)، أجب فوراً بدقة مستخدماً الأرقام والتفاصيل الواردة أعلاه.
`;
    } else {
      systemPrompt += `المستخدم الحالي زائر أو طالب لم يقم بتسجيل الدخول بعد للبوابة (وضع الزائر - Public Guest Mode).
معلومات عن أكاديمية صابر جروب (Saber Group):
- أكاديمية صابر جروب تقدم مسارات احترافية في: Web Development (React & Node.js), Mobile Apps (Flutter & React Native), AI & Python, UI/UX Design, Cyber Security.
- المزايا: تطبيق عملي 100%، مشاريع تخرج، شهادات معتمدة، متابعة فردية.
أجب عن الأسئلة العامة حول الكورسات والتسجيل بحب ورحابة. وإذا سألك الزائر عن بيانات شخصية (مثل: مواعيد محاضرته، غيابه، أو درجاته)، اطلب منه تسجيل الدخول إلى البوابة باستخدام رقم الـ ID وكلمة السر الخاصة به!
`;
    }

    const contentsList = [];
    contentsList.push({
      role: 'user',
      parts: [{ text: `System Instruction Context:\n${systemPrompt}` }]
    });
    contentsList.push({
      role: 'model',
      parts: [{ text: 'أهلاً بك! أنا جاهز تماماً بصفتي GEMY المساعد الذكي لصابر جروب. كيف يمكنني مساعدتك اليوم؟ 🤖' }]
    });

    if (history && Array.isArray(history) && history.length > 0) {
      for (const item of history.slice(-6)) {
        if (item.role && item.parts && item.parts.length > 0) {
          contentsList.push({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: item.parts[0].text || '' }]
          });
        }
      }
    }

    contentsList.push({
      role: 'user',
      parts: [{ text: message }]
    });

    if (apiKey) {
      const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const modelName of modelsToTry) {
        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contentsList })
          });
          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (replyText) {
              return res.json({ reply: replyText });
            }
          }
        } catch (err) {
          console.warn(`Cloud Function Gemini call model ${modelName} failed:`, err);
        }
      }
    }

    // Smart Fallback when API key is missing or call fails in Cloud Functions
    let fallbackReply = "";
    if (studentContext) {
      fallbackReply = `أهلاً بك يا ${studentContext.name || 'عزيزي الطالب'}! 🤖\n`;
      if (message.includes('غياب') || message.includes('حضور')) {
        fallbackReply += `نسبة حضورك حالياً هي ${studentContext.attendanceRate || 0}% (حضرت ${studentContext.attendedCount || 0} من إجمالي ${studentContext.totalSessions || 0} محاضرة).`;
      } else if (message.includes('مالي') || message.includes('رسوم') || message.includes('دفع') || message.includes('فلوس')) {
        fallbackReply += `موقفك المالي: المسدد (${studentContext.paidAmount || 0} ج.م) والمتبقي (${studentContext.remainingBalance || 0} ج.م). ${studentContext.remainingBalance > 0 ? '⚠️ يوجد متبقي رسوم.' : 'تم السداد بالكامل ✅'}`;
      } else if (message.includes('محاضرة') || message.includes('موعد') || message.includes('ميعاد')) {
        fallbackReply += `المحاضرة القادمة: ${studentContext.nextSessionDate ? `بتاريخ ${studentContext.nextSessionDate} ${studentContext.nextSessionTime || ''}` : 'لا توجد مواعيد جديدة مضافة حالياً.'}`;
      } else {
        fallbackReply += `أنا جيمي مساعدك في صابر جروب! أنت مسجل في مجموعة (${studentContext.groupName || 'جروبك'}) بكورس (${studentContext.courseName || 'المسار'}). يمكنك الاستفسار عن المواعيد والغياب والرسوم، أو التواصل مع خدمة العملاء والجروب!`;
      }
    } else {
      fallbackReply = `أهلاً بك في أكاديمية Saber Group! 🤖\nيسعدنا إجابة كافة استفساراتك حول الكورسات والمسارات التدريبية والتسجيل. يمكنك التواصل معنا مباشرة عبر خدمة العملاء أو جروب الواتساب الخاص بك!`;
    }

    res.json({ reply: fallbackReply });

  } catch (err) {
    console.error("Error in handleGemyChat:", err);
    res.status(500).json({ error: err.message || "فشل الاتصال بجيمي" });
  }
}

// =========================================================================
// FIREBASE CLOUD FUNCTIONS EXPORTS (TOP-LEVEL NAMED EXPORTS)
// =========================================================================

exports.gemyChat = onRequest({ cors: true }, (req, res) => {
  return corsHandler(req, res, () => handleGemyChat(req, res));
});

exports.googleOAuthStart = onRequest({ cors: true }, (req, res) => {
  return corsHandler(req, res, () => handleGoogleOAuthStart(req, res));
});

exports.googleOAuthCallback = onRequest({ cors: true }, (req, res) => {
  return corsHandler(req, res, () => handleGoogleOAuthCallback(req, res));
});

exports.syncGroupCalendar = onRequest({ cors: true }, (req, res) => {
  return corsHandler(req, res, () => handleSyncGroupCalendar(req, res));
});

exports.updateSessionSchedule = onRequest({ cors: true }, (req, res) => {
  return corsHandler(req, res, () => handleUpdateSessionSchedule(req, res));
});

exports.sendEmail = onRequest({ cors: true }, (req, res) => {
  return corsHandler(req, res, () => handleSendEmail(req, res));
});

exports.sendTestEmail = onRequest({ cors: true }, (req, res) => {
  return corsHandler(req, res, () => handleSendTestEmail(req, res));
});

exports.deleteGroupCalendar = onRequest({ cors: true }, (req, res) => {
  return corsHandler(req, res, () => handleDeleteGroupCalendar(req, res));
});

// =========================================================================
// EXPRESS APP EXPORT FOR /api BASE PATH (EXPRESS PROXY)
// =========================================================================

const apiApp = express();
apiApp.use(cors({ origin: true, credentials: true }));
apiApp.use(express.json());

// Support both /api/* and /* paths when rewritten via Firebase Hosting
apiApp.use((req, res, next) => {
  if (req.url && req.url.startsWith("/api/")) {
    req.url = req.url.substring(4);
  }
  next();
});

apiApp.post("/gemy-chat", handleGemyChat);
apiApp.post("/api/gemy-chat", handleGemyChat);

apiApp.get("/google/auth-url", handleGoogleOAuthStart);
apiApp.get("/google/callback", handleGoogleOAuthCallback);
apiApp.post("/google/sync-group-calendar", handleSyncGroupCalendar);
apiApp.post("/google/delete-group-calendar", handleDeleteGroupCalendar);
apiApp.post("/google/reschedule-session-event", handleUpdateSessionSchedule);
apiApp.post("/google/update-session-schedule", handleUpdateSessionSchedule);
apiApp.post("/google/send-email", handleSendEmail);
apiApp.post("/google/send-test-email", handleSendTestEmail);
apiApp.post("/google/record-audit-log", handleRecordAuditLog);

apiApp.get("/google/connections", async (req, res) => {
  try {
    const snap = await db.collection("googleConnections").get();
    const connections = snap.docs.map(doc => {
      const data = doc.data();
      const { encryptedRefreshToken, ...safeData } = data;
      return { id: doc.id, ...safeData };
    });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiApp.get("/google/email-logs", async (req, res) => {
  try {
    const snap = await db.collection("emailLogs").orderBy("sentAt", "desc").limit(100).get();
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiApp.get("/google/audit-logs", async (req, res) => {
  try {
    const snap = await db.collection("googleAuditLogs").orderBy("timestamp", "desc").limit(100).get();
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiApp.post("/google/disconnect", async (req, res) => {
  try {
    const { id, email } = req.body;
    let targetDocId = id;
    if (!targetDocId && email) {
      targetDocId = email.replace(/[^a-z0-9_]/g, "_");
    }
    if (!targetDocId) {
      return res.status(400).json({ error: "معرّف الحساب مطلوبة لقطع الاتصال" });
    }

    await db.collection("googleConnections").doc(targetDocId).update({
      status: "disconnected",
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, message: "تم قطع اتصال الحساب بنجاح" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiApp.post("/google/test-connection", async (req, res) => {
  try {
    const { id, email } = req.body;
    let targetDocId = id;
    if (!targetDocId && email) {
      targetDocId = email.replace(/[^a-z0-9_]/g, "_");
    }

    const docSnap = await db.collection("googleConnections").doc(targetDocId).get();
    if (!docSnap.exists) {
      return res.json({ success: false, message: "الحساب غير موجود في سجلات المزامنة." });
    }

    const data = docSnap.data();
    if (data.status !== "connected") {
      return res.json({ success: false, message: `حالة الحساب حالياً: ${data.status}` });
    }

    res.json({ success: true, message: `الحساب (${data.googleEmail || data.email}) فعال ومربوط بنجاح.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

exports.api = onRequest({ cors: true }, apiApp);

// Reliable, server-side replacement for the old client-side "someone happened
// to have the Follow-ups page open" activation of scheduled follow-ups.
// Runs daily and flips any follow-up whose scheduled re-check date has
// arrived back to active, regardless of whether anyone is using the app.
const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.autoActivateScheduledFollowUps = onSchedule("every day 06:00", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const snap = await db.collection("studentFollowUps")
    .where("status", "==", "scheduled")
    .where("scheduledAt", "<=", today)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      status: "active",
      colorStatus: "yellow",
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
});
