import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import { buildSaberEmailTemplate } from "./lib/emailTemplates";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, updateDoc, addDoc, query, where, orderBy, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDALDGiPJQUOV1FODEC-Wv9lof0fbDI6GI",
  authDomain: "sg-tms-v2.firebaseapp.com",
  projectId: "sg-tms-v2",
  storageBucket: "sg-tms-v2.firebasestorage.app",
  messagingSenderId: "713765974154",
  appId: "1:713765974154:web:59f41edc6ed512a0dd3d73",
  measurementId: "G-43X8CK85LQ"
};

const serverApps = getApps();
const serverApp = serverApps.length > 0 ? serverApps[0] : initializeApp(firebaseConfig, "serverApp");
const serverDb = getFirestore(serverApp);

// Encryption Helpers for OAuth Refresh Tokens
const DEFAULT_GOOGLE_CLIENT_ID = "713765974154-thn039cs640kj45t661idkgeq0o3m3ik.apps.googleusercontent.com";
const DEFAULT_GOOGLE_CLIENT_SECRET = "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";
const DEFAULT_ENCRYPTION_KEY = "522d0c9e1739b49296ec0583249a757b5cb580acfa8115675ce1f2bf5a395eb9";

const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || process.env.GOOGLE_CLIENT_SECRET || DEFAULT_ENCRYPTION_KEY;
const ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_SECRET).digest();
}

function encryptToken(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

function decryptToken(encryptedText: string): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 2) return encryptedText;
  try {
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

function getOAuth2Client(req: express.Request) {
  const rawProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const firstProto = rawProto.split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
  
  // Force https for all remote/production/preview domains (not localhost)
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const protocol = isLocal ? (firstProto.includes('https') ? 'https' : 'http') : 'https';
  
  const redirectUri = `${protocol}://${host}/api/google/callback`;
  console.log(`[OAuth Redirect URI]: ${redirectUri}`);

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET || DEFAULT_GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON request bodies
  app.use(express.json());

  // API Proxy for Gemini Lecture Assistant
  app.post("/api/gemini/assist", async (req, res) => {
    try {
      const { courseName, sessionNum, checklistItems, previousNotes } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is not defined in the system. Please configure it in your Settings > Secrets panel." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Construct a targeted professional Arabic prompt for Saber Group trainer support
      const prompt = `
أنت مساعد ذكي مخصص لدعم المدربين والمحاضرين في "Saber Group" للتدريب الفني والبرمجي.
المقرر الحالي: "${courseName || 'عام'}"
رقم المحاضرة الجارية: ${sessionNum || 1}
بنود الـ Checklist (الموضوعات والمخرجات المطلوبة شرحها في هذه المحاضرة):
${(checklistItems || []).map((item: any, i: number) => `- البند [${i+1}]: ${item.title} ${item.description ? `(${item.description})` : ''}`).join('\n')}
${previousNotes ? `ملاحظات الجلسة السابقة أو توجيهات المدرب: ${previousNotes}` : ''}

المطلوب:
تقديم 3 إلى 4 نقاط توجيهية موجزة وتفاعلية باللغة العربية لمساعدة المدرب أثناء الشرح الفعلي:
1. نصيحة عملية لكيفية شرح وتطبيق أهم البنود المذكورة اليوم تفاعلياً.
2. تمرين تطبيقي سريع (Hands-on Practice) ينفذه الطلاب في منتصف المحاضرة لقياس استيعابهم.
3. التنبيه على خطأ فني أو تشتت شائع يقع فيه المتدربون عادة عند تعلم هذه المواضيع اليوم وكيفية تفاديه.
4. سؤال قياسي سريع (Concept Check Question) يطرحه المدرب على الطلاب لمعرفة مدى نضج فهمهم الفني.

اكتب الإجابة بلغة عربية مهنية، واضحة، مختصرة وبسيطة، مستخدماً تنسيق Markdown بأسلوب جذاب.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

      res.json({ result: response.text });
    } catch (err: any) {
      console.error("Gemini assist error:", err);
      res.status(500).json({ error: err.message || "فشل توليد التوجيهات من المساعد الذكي." });
    }
  });

  // GEMY AI Assistant Endpoint for Student Portal & Staff Application
  const handleGemyChatExpress = async (req: express.Request, res: express.Response) => {
    try {
      const { message, history, studentContext, staffContext, courses } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: "الرسالة مطلوبة (message is required)." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "مفتاح GEMINI_API_KEY غير معرف بالنظام. يرجى إضافته في إعدادات البيئة." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Helper for smart name parsing in server.ts
      const parseSmartName = (rawName: string = '', isStaff: boolean = false) => {
        if (!rawName) return { cleanFirstName: '', honorificTitle: isStaff ? 'باشمهندس' : '', greetingName: isStaff ? 'باشمهندس' : '' };
        let trimmed = rawName.trim();
        let honorificTitle = isStaff ? 'باشمهندس' : '';

        const engPattern = /^(eng\.?|engineer|م\.?|م\/|باشمهندس|مهندس|المهندس)\s+/i;
        const docPattern = /^(dr\.?|doctor|د\.?|د\/|دكتور|الدكتور)\s+/i;
        const mrPattern = /^(mr\.?|mrs\.?|ms\.?|أ\.?|أ\/|استاذ|الأستاذ|الاستاذ)\s+/i;
        const profPattern = /^(prof\.?|professor|بروف|بروفيسور)\s+/i;

        if (engPattern.test(trimmed)) {
          honorificTitle = 'باشمهندس';
          trimmed = trimmed.replace(engPattern, '').trim();
        } else if (docPattern.test(trimmed)) {
          honorificTitle = 'د.';
          trimmed = trimmed.replace(docPattern, '').trim();
        } else if (mrPattern.test(trimmed)) {
          honorificTitle = 'أ.';
          trimmed = trimmed.replace(mrPattern, '').trim();
        } else if (profPattern.test(trimmed)) {
          honorificTitle = 'بروفيسور';
          trimmed = trimmed.replace(profPattern, '').trim();
        }

        const parts = trimmed.split(/\s+/).filter(Boolean);
        const cleanFirstName = parts[0] || trimmed;
        const greetingName = honorificTitle ? `${honorificTitle} ${cleanFirstName}` : cleanFirstName;
        return { cleanFirstName, honorificTitle, greetingName };
      };

      let systemPrompt = `أنت "MARO" (مارو)، المساعد الذكي التفاعلي الرسمي لأكاديمية Saber Group (صابر جروب للتدريب والتطوير البرمجي والتقني).
مهمتك الأساسية هي الإجابة عن استفسارات المستخدمين (طلاب، مدربين، كورديناتورز، وقيادات) بأسلوب عربي وودي، مشجع، محترف، وإيجابي، مع استخدام الإيموجي المناسب بشكل لطيف.
كن دائماً دقيقاً ومباشراً ومختصراً.

تعليمات هامة للتنسيق والمخاطبة:
1. تجنب طباعة النجوم المزدوجة الخام ** أو أوساط المارك داون المعقدة دون تنسيق. صُغ الإجابة بفقرات قصيرة ونقاط عريضة واضحة.
2. عند مخاطبة المستخدم باسمه، خُاطبه بالاسم الأول واللقب المناسب (مثال: "${staffContext ? parseSmartName(staffContext.name, true).greetingName : 'يا عزيزي'}") واجتنب تماماً استقطاع بادئات الألقاب مثل "eng" أو "dr" وحدها دون اسم.

`;

      if (courses && Array.isArray(courses) && courses.length > 0) {
        systemPrompt += `الكورسات والمسارات المتاحة حالياً في الأكاديمية:\n${courses.map((c: any) => `- ${c.title || c.name || c} (${c.description || ''})`).join('\n')}\n\n`;
      }

      if (staffContext) {
        // Staff/Trainer/Admin mode
        const roleTitles: Record<string, string> = {
          admin: 'المدير العام والنظام (Admin Master)',
          team_leader: 'قائد الفريق (Team Leader)',
          coordinator: 'منسق التدريب (Training Coordinator)',
          trainer: 'مدرب معتمد (Trainer)'
        };

        const currentRoleTitle = roleTitles[staffContext.role] || staffContext.role || 'عضو فريق العمل';
        const smartName = parseSmartName(staffContext.name, true);

        systemPrompt += `المستخدم الحالي عضو في فريق عمل الأكاديمية (داخلي):
- الاسم الكامل: ${staffContext.name || 'غير محدد'}
- الاسم الأول الحقيقي: ${smartName.cleanFirstName}
- طريقة النداء والمخاطبة الصحيحة: "${smartName.greetingName}" (ملاحظة: نادِه بـ "${smartName.greetingName}" واجتنب الكلمات المجردة مثل "eng").
- الدور / الوظيفة (Role): ${currentRoleTitle} (${staffContext.role})
- البريد الإلكتروني: ${staffContext.email || 'N/A'}
- حالة الحساب: ${staffContext.active ? 'نشط ✅' : 'موقوف'}

حدود الصلاحيات وقواعد الإجابة حسب Role المستخدم:
1. إذا كان المستخدم Admin: يمتلك كامل الصلاحيات في النظام (الماليات، الرواتب، الإعدادات، المستخدمين، الكورسات).
2. إذا كان المستخدم Team Leader: يمتلك صلاحية متابعة أداء الجروبات والمدربين، مراجعة المحاضرات، وتقييم KPIs.
3. إذا كان المستخدم Coordinator: يمتلك صلاحيات إدارة الجروبات، التواصل مع الطلاب، الشكاوى، والمتابعات الدورية.
4. إذا كان المستخدم Trainer (مدرب): يمتلك صلاحية تسجيل حضور محاضرته، شرح بنود الـ Checklist، إضافة البريكات والتطبيقات، ومتابعة طلابه.

⚠️ قاعدة ذهبية هامة جداً للسلامة والصلاحيات:
إذا طلب المستخدم (المدرب أو المنسق أو قائد الفريق) إجراءً أو تغيير بيانات تخرج عن نطاق صلاحياته المحددة أعلاه (مثل: تعديل راتبه أو ساعات معتمدة، حذف بيانات مالية، تعديل صلاحيات المستخدمين، أو تغيير إعدادات الأكاديمية)، يجب عليك الرد فوراً وبكل أدب ووضوح:
"⚠️ هذا الإجراء يتطلب موافقة الأدمن الرئيسي للإدارة (Admin Approval Required). يرجى التوجه مجهوداً للوحة الإدارة أو التواصل مع Eng. Mohamed Saber لاكتساب الصلاحية أو اعتماد التعديل."

قدّم للمدرب/الموظف النصائح التقنية والإرشادية بكيفية استخدام لوحات النظام (مثل لوحة Trainer KPIs، تسجيل المحاضرات، تقييم الجروبات، إدارة الشكاوى) لإنجاز مهامه اليومية بفعالية.
`;
      } else if (studentContext) {
        // Student mode
        const smartName = parseSmartName(studentContext.name, false);
        systemPrompt += `المستخدم الحالي متدرب مسجل ومسجل دخوله للبوابة بالبيانات الرسمية التالية:
- اسم المتدرب الكامل: ${studentContext.name || 'غير محدد'}
- الاسم الأول الحقيقي: ${smartName.cleanFirstName}
- طريقة النداء والمخاطبة: "${smartName.greetingName}"
- كود/رقم الطالب (ID): ${studentContext.studentIdNum || studentContext.id || 'N/A'}
- اسم الجروب / المجموعة: ${studentContext.groupName || 'غير محدد'}
- اسم المسار / الكورس: ${studentContext.courseName || 'غير محدد'}
- حالة القيد: ${studentContext.status === 'active' ? 'نشط ومستمر في الدراسة ✅' : 'مكتمل / خريج'}
- نسبة الحضور: حضر (${studentContext.attendedCount || 0}) محاضرة من إجمالي (${studentContext.totalSessions || 0}) محاضرة تم تنفيذها (نسبة الحضور الحالية: ${studentContext.attendanceRate || '0'}%).
- الواجبات والتطبيق العملي: قام بتسليم (${studentContext.submittedEvaluationsCount || 0}) واجب/تطبيق، إجمالي نقاط التميز المكافأة: (${studentContext.totalPoints || 0}) نقطة، إجمالي الجزاءات/الخصم: (${studentContext.totalPenalties || 0}) نقطة.
- الموقف المالي: إجمالي المصاريف المستحقة (${studentContext.totalCourseFee || 0} ج.م)، المبلغ المسدد (${studentContext.paidAmount || 0} ج.م)، المتبقي المستحق (${studentContext.remainingBalance || 0} ج.م) ${studentContext.remainingBalance > 0 ? '⚠️ يوجد متبقي رسوم' : 'تم سداد الرسوم بالكامل ✅'}.
- المحاضرة القادمة: ${studentContext.nextSessionDate ? `بتاريخ ${studentContext.nextSessionDate} في تمام ${studentContext.nextSessionTime || ''}` : 'لا توجد مواعيد محاضرات جديدة مضافة حالياً'}.
- رابط المحاضرة الأونلاين (Meet / Zoom): ${studentContext.googleMeetUrl || 'رابط الحضور يظهر في جدول البوابة قبل بدء المحاضرة'}.

تنبيه هام للتعامل مع المتدرب:
عندما يسألك المتدرب عن أي تفاصيل خاصة به (مثل: كم عدد غيابي؟ متى المحاضرة القادمة؟ هل علي واجب؟ ما هو موقفي المالي؟ كم عدد نقاطي؟)، أجب فوراً بدقة مستخدماً الأرقام والتفاصيل الواردة أعلاه.

قاعدة معالجة الأسئلة خارج النطاق (Out of Scope):
إذا تساءل المستخدم عن شيء خارج نطاق أكاديمية Saber Group وخارج السيستم والمعلومات المتاحة (مثل أسئلة عامة أو موضوعات خارجية لا تتوفر لها إجابة في السيستم)، أجب بوضوح ولطف:
"عذراً، هذه المعلومة خارج نطاق معرفتي بالنظام حالياً. يسعدنا مساعدتك عبر التواصل المباشر مع خدمة العملاء أو طرح سؤالك في جروب الواتساب الخاص بمجموعتك!"
`;
      } else {
        systemPrompt += `المستخدم الحالي زائر أو طالب لم يقم بتسجيل الدخول بعد للبوابة (وضع الزائر - Public Guest Mode).

معلومات عن أكاديمية صابر جروب (Saber Group):
- صابر جروب هي أكاديمية رائدة في التدريب البرمجي والتقني والتجهيز لسوق العمل.
- توفر مسارات تدريبية احترافية مثل:
  * تطوير تطبيقات الويب الكاملة (Full Stack Web Development - React & Node.js)
  * تطوير تطبيقات الموبايل (Mobile Apps - Flutter & React Native)
  * الذكاء الاصطناعي وتحليل البيانات (AI & Data Science & Python)
  * تصميم واجهات المستخدم (UI/UX Design)
  * شبكات وأمن المعلومات (Cyber Security & Networking)
  * اختبار جودة البرمجيات (Software Testing & QA)
- المزايا: تطبيق عملي 100%، متابعة فردية، مشاريع تخرج حقيقية، شهادات معتمدة، ودعم فني مستمر.
- كيفية تسجيل الدخول للطالب المسجل: يستطيع الطالب تسجيل الدخول بالـ Student ID وكلمة السر المسلمة له لمتابعة الجدول والحضور والواجبات والمواد العلمية.
- كيفية التسجيل والانضمام: التواصل مع الأكاديمية عبر الواتساب أو مقر الأكاديمية لحجز الدفعات القادمة.

إرشادات للرد على الزائر:
أجب عن الأسئلة العامة حول الكورسات والمسارات وطريقة التسجيل بكل حب ورحابة صدر. وإذا سألك الزائر عن بيانات شخصية (مثل: مواعيد محاضرته، غيابه، أو درجاته)، وضح له بلطف ومباشرة:
"أهلاً بك! لمتابعة بياناتك الشخصية ومواعيد مجموعتك وحضورك ودرجاتك، يرجى تسجيل الدخول إلى البوابة باستخدام رقم الـ ID والكلمة السرية الخاصة بك!"
`;
      }

      // Build contents array for Gemini chat
      const contentsList: any[] = [];
      
      // Add system context first
      contentsList.push({
        role: 'user',
        parts: [{ text: `System Instruction Context:\n${systemPrompt}` }]
      });
      contentsList.push({
        role: 'model',
        parts: [{ text: 'أهلاً بك! أنا جاهز تماماً بصفتي MARO المساعد الذكي لصابر جروب. كيف يمكنني مساعدتك اليوم؟ 🤖' }]
      });

      // Append past history if available
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

      // Append current user message
      contentsList.push({
        role: 'user',
        parts: [{ text: message }]
      });

      // Try multiple valid models with auto-fallback if high demand occurs
      const modelsToTry = ['gemini-3.6-flash', 'gemini-flash-latest'];
      let response = null;
      let lastError = null;

      for (const modelName of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contentsList,
          });
          if (response && response.text) break;
        } catch (err: any) {
          console.warn(`MARO AI model ${modelName} failed or busy, trying fallback...`, err?.message || err);
          lastError = err;
          // Short delay before fallback retry
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error("تعذر الحصول على رد من نماذج الذكاء الاصطناعي بسبب الضغط المؤقت على الخوادم.");
      }

      const replyText = response.text || "عذراً، لم أستطع فهم الطلب بشكل كامل. كيف يمكنني مساعدتك أكثر؟ 🤖";
      res.json({ reply: replyText });

    } catch (error: any) {
      console.error("MARO AI Chat API Error:", error);
      let errMsg = "حدث خطأ غير متوقع في محادثة MARO.";
      if (typeof error === 'string') {
        errMsg = error;
      } else if (error?.message) {
        errMsg = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
      } else if (error) {
        errMsg = JSON.stringify(error);
      }
      res.status(500).json({ error: errMsg });
    }
  };

  app.post("/api/maro-chat", handleGemyChatExpress);
  app.post("/maro-chat", handleGemyChatExpress);
  app.post("/api/gemy-chat", handleGemyChatExpress);
  app.post("/gemy-chat", handleGemyChatExpress);

  // Google OAuth Authorization URL endpoint
  app.get("/api/google/auth-url", (req, res) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || DEFAULT_GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(400).json({
          error: "معرف العميل (GOOGLE_CLIENT_ID) أو السر المفتاحي غير معرف في بيئة العمل. يرجى ضبط المتغيرات في الإعدادات أو قبول إعداد OAuth."
        });
      }
      const type = req.query.type === 'central' ? 'central' : 'organizer';
      const trainerId = (req.query.trainerId as string) || '';
      const userId = (req.query.userId as string) || '';
      const accountType = (req.query.accountType as string) || (type === 'central' ? 'admin' : 'trainer');

      const oauth2Client = getOAuth2Client(req);

      const scopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/meetings.space.created',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ];

      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state: JSON.stringify({ type, trainerId, userId, accountType })
      });

      res.json({ url });
    } catch (err: any) {
      console.error("Error generating OAuth URL:", err);
      res.status(500).json({ error: err.message || "Failed to generate Google OAuth URL" });
    }
  });

  // Google OAuth Callback endpoint
  app.get("/api/google/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;
      if (error) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8">
            <title>خطأ في مصادقة Google</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #ef4444; text-align: center; max-width: 450px; }
              h2 { color: #f87171; margin-top: 0; }
              button { background: #ef4444; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-top: 1rem; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>⚠️ فشل الاتصال بحساب Google</h2>
              <p>${error}</p>
              <button onclick="window.close()">إغلاق النافذة</button>
            </div>
          </body>
          </html>
        `);
      }

      if (!code) {
        return res.status(400).send("No authorization code provided");
      }

      let type = 'organizer';
      let trainerId = '';
      let userId = '';
      let accountType = 'trainer';

      if (state) {
        try {
          const parsed = JSON.parse(state as string);
          if (parsed.type === 'central') type = 'central';
          if (parsed.trainerId) trainerId = parsed.trainerId;
          if (parsed.userId) userId = parsed.userId;
          if (parsed.accountType) accountType = parsed.accountType;
        } catch (e) {
          console.warn("Failed to parse OAuth state:", state);
        }
      }

      const oauth2Client = getOAuth2Client(req);
      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfoResponse = await oauth2.userinfo.get();
      const userEmail = (userInfoResponse.data.email || '').toLowerCase().trim();
      const displayName = userInfoResponse.data.name || userEmail.split('@')[0];

      // Automatically force central account classification for sabergroup.eg@gmail.com
      if (userEmail === 'sabergroup.eg@gmail.com') {
        type = 'central';
        accountType = 'admin';
        trainerId = '';
      }

      // RESTRICTION: Central Email must strictly be sabergroup.eg@gmail.com
      if (type === 'central' && userEmail !== 'sabergroup.eg@gmail.com') {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8">
            <title>خطأ في ربط الحساب الرسمي</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #1e293b; padding: 2.5rem; border-radius: 1.25rem; border: 1px solid #f59e0b; text-align: center; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
              h2 { color: #fbbf24; margin-top: 0; font-size: 1.5rem; }
              p { line-height: 1.6; color: #cbd5e1; }
              .badge { background: #334155; padding: 0.5rem 1rem; border-radius: 0.5rem; color: #f87171; font-weight: bold; font-family: monospace; }
              button { background: #d97706; color: white; border: none; padding: 0.75rem 1.75rem; border-radius: 0.75rem; font-weight: bold; cursor: pointer; margin-top: 1.5rem; transition: background 0.2s; }
              button:hover { background: #b45309; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>⚠️ الحساب المختار غير مسموح به لهذا الدور</h2>
              <p>الحساب الرسمي للنظام (Central Email) مخصص حصرياً للإيميل:</p>
              <p><span class="badge" style="color: #4ade80;">sabergroup.eg@gmail.com</span></p>
              <p>الحساب الذي قمت بتسجيل الدخول به هو: <br><span class="badge">${userEmail}</span></p>
              <p>يرجى إعادة المحاولة واختيار الحساب الرسمي المعتمد sabergroup.eg@gmail.com.</p>
              <button onclick="window.close()">إغلاق النافذة وتصحيح الحساب</button>
            </div>
          </body>
          </html>
        `);
      }

      const docId = type === 'central' ? 'sabergroup_eg_gmail_com' : (trainerId ? `trainer_${trainerId}` : userEmail.replace(/[^a-z0-9_]/g, '_'));
      const connRef = doc(serverDb, "googleConnections", docId);
      const existingSnap = await getDoc(connRef);
      const existingData = existingSnap.exists() ? existingSnap.data() : null;

      let encryptedRefreshToken = "";
      if (tokens.refresh_token) {
        encryptedRefreshToken = encryptToken(tokens.refresh_token);
      } else if (existingData && existingData.encryptedRefreshToken) {
        encryptedRefreshToken = existingData.encryptedRefreshToken;
      }

      const nowIso = new Date().toISOString();
      const updatePayload = {
        id: docId,
        userId: userId || existingData?.userId || '',
        trainerId: trainerId || existingData?.trainerId || '',
        email: userEmail,
        googleEmail: userEmail,
        displayName,
        accountType: type === 'central' ? 'admin' : (accountType || 'trainer'),
        type, // 'central' | 'organizer'
        status: 'connected',
        encryptedRefreshToken,
        accessTokenExpiry: tokens.expiry_date || null,
        lastConnectedAt: nowIso,
        createdAt: existingData?.createdAt || nowIso,
        updatedAt: nowIso
      };

      await setDoc(connRef, updatePayload, { merge: true });

      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>تم الاتصال بنجاح</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 1.25rem; border: 1px solid #10b981; text-align: center; max-width: 450px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            h2 { color: #34d399; margin-top: 0; font-size: 1.5rem; }
            p { color: #cbd5e1; }
            .email { color: #60a5fa; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✅ تم ربط حساب Google بنجاح</h2>
            <p>الحساب: <span class="email">${userEmail}</span></p>
            <p>نوع الربط: ${type === 'central' ? 'الحساب الرسمي للنظام (Central Email)' : 'حساب مدرب (Trainer Connection)'}</p>
            <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 1.5rem;">جاري إغلاق هذه النافذة وتحديث القائمة...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', email: '${userEmail}' }, '*');
              setTimeout(() => window.close(), 1800);
            } else {
              const targetPath = '${accountType === 'trainer' ? '/#/trainer/google-connect?success=true' : '/#/google-integrations?success=true'}';
              setTimeout(() => { window.location.href = targetPath; }, 2000);
            }
          </script>
        </body>
        </html>
      `);

    } catch (err: any) {
      console.error("OAuth callback error:", err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>خطأ في معالجة الربط</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #ef4444; text-align: center; max-width: 450px; }
            h2 { color: #f87171; margin-top: 0; }
            button { background: #ef4444; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ حدث خطأ أثناء معالجة ربط الحساب</h2>
            <p>${err.message || 'خطأ غير معروف'}</p>
            <button onclick="window.close()">إغلاق النافذة</button>
          </div>
        </body>
        </html>
      `);
    }
  });

  // Fetch Google Connections (SECURE: Strips encryptedRefreshToken)
  app.get("/api/google/connections", async (req, res) => {
    try {
      const snap = await getDocs(collection(serverDb, "googleConnections"));
      const connections = snap.docs.map(docItem => {
        const data = docItem.data();
        const { encryptedRefreshToken, ...safeData } = data;
        if (safeData.email?.toLowerCase() === 'sabergroup.eg@gmail.com' || docItem.id === 'sabergroup_eg_gmail_com') {
          safeData.type = 'central';
          safeData.accountType = 'admin';
        }
        return safeData;
      });
      res.json(connections);
    } catch (err: any) {
      console.error("Error fetching google connections:", err);
      res.status(500).json({ error: err.message || "Failed to fetch connections" });
    }
  });

  // Test Connection Endpoint
  app.post("/api/google/test-connection", async (req, res) => {
    try {
      const { id, email } = req.body;
      const targetId = id || (email ? email.replace(/[^a-z0-9_]/g, '_') : '');
      if (!targetId) {
        return res.status(400).json({ error: "Missing connection ID or email" });
      }

      const docRef = doc(serverDb, "googleConnections", targetId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: "Connection record not found" });
      }

      const data = snap.data();
      if (!data.encryptedRefreshToken) {
        await updateDoc(docRef, { status: 'reconnect_required', updatedAt: new Date().toISOString() });
        return res.json({ success: false, status: 'reconnect_required', message: 'لا يوجد Refresh Token محفوظ لهذا الحساب. يرجى إعادة الاتصال.' });
      }

      const refreshToken = decryptToken(data.encryptedRefreshToken);
      if (!refreshToken) {
        await updateDoc(docRef, { status: 'reconnect_required', updatedAt: new Date().toISOString() });
        return res.json({ success: false, status: 'reconnect_required', message: 'تعذر فك تشفير التوكن. يرجى إعادة الاتصال.' });
      }

      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userinfo = await oauth2.userinfo.get();

      const nowIso = new Date().toISOString();
      await updateDoc(docRef, {
        status: 'connected',
        displayName: userinfo.data.name || data.displayName,
        lastConnectedAt: nowIso,
        updatedAt: nowIso
      });

      res.json({ success: true, status: 'connected', email: userinfo.data.email, message: 'الاتصال بحساب Google يعمل بشكل سليم!' });
    } catch (err: any) {
      console.error("Test connection failed:", err);
      try {
        const targetId = req.body.id || (req.body.email ? req.body.email.replace(/[^a-z0-9_]/g, '_') : '');
        if (targetId) {
          await updateDoc(doc(serverDb, "googleConnections", targetId), {
            status: 'reconnect_required',
            updatedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Failed to update status on test error:", e);
      }

      res.json({ success: false, status: 'reconnect_required', error: err.message || 'فحص الاتصال فشل. يرجى إعادة الربط.' });
    }
  });

  // Disconnect Endpoint
  app.post("/api/google/disconnect", async (req, res) => {
    try {
      const { id, email } = req.body;
      const targetId = id || (email ? email.replace(/[^a-z0-9_]/g, '_') : '');
      if (!targetId) {
        return res.status(400).json({ error: "Missing connection ID or email" });
      }

      const docRef = doc(serverDb, "googleConnections", targetId);
      await updateDoc(docRef, {
        status: 'disconnected',
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true, message: 'تم قطع اتصال الحساب بنجاح' });
    } catch (err: any) {
      console.error("Disconnect error:", err);
      res.status(500).json({ error: err.message || "Failed to disconnect account" });
    }
  });

  // ==========================================
  // PHASE 2: Email Service via Gmail API (Central Email Only)
  // ==========================================

  async function getCentralOAuthClient(req: express.Request) {
    const docId = "sabergroup_eg_gmail_com";
    const centralDocRef = doc(serverDb, "googleConnections", docId);
    let snap = await getDoc(centralDocRef);

    if (!snap.exists()) {
      const q = query(collection(serverDb, "googleConnections"), where("type", "==", "central"), where("status", "==", "connected"));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        snap = querySnap.docs[0];
      }
    }

    if (!snap.exists()) {
      const q = query(collection(serverDb, "googleConnections"), where("status", "==", "connected"));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        snap = querySnap.docs[0];
      }
    }

    if (!snap.exists()) {
      throw new Error("لم يتم ربط حساب Google بالنظام بعد. يرجى الدخول لصفحة Google Integrations أو Trainer Connect والضغط على Connect Google Account.");
    }

    const data = snap.data();
    if (data.status !== 'connected' || !data.encryptedRefreshToken) {
      throw new Error("الحساب الرسمي للنظام (sabergroup.eg@gmail.com) بحاجة لإعادة الاتصال (Reconnect Required).");
    }

    const refreshToken = decryptToken(data.encryptedRefreshToken);
    if (!refreshToken) {
      throw new Error("تعذر فك تشفير توكن الحساب الرسمي للنظام.");
    }

    const oauth2Client = getOAuth2Client(req);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return { oauth2Client, email: data.email || 'sabergroup.eg@gmail.com' };
  }

  function buildEmailTemplate(template: string, data: any, masterLayout?: any) {
    return buildSaberEmailTemplate(template, data, masterLayout);
  }

  async function sendGmailMessage(oauth2Client: any, fromEmail: string, toEmail: string, subject: string, htmlBody: string) {
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

  // API Endpoint: Send Email (Phase 2)
  app.post("/api/google/send-email", async (req, res) => {
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
          let tSnap = await getDoc(doc(serverDb, "emailTemplates", template));
          if (!tSnap.exists() || !tSnap.data()?.bodyHtml) {
            if (template === 'welcome_group' || template === 'welcome') {
              const altId = template === 'welcome_group' ? 'welcome' : 'welcome_group';
              const altSnap = await getDoc(doc(serverDb, "emailTemplates", altId));
              if (altSnap.exists() && altSnap.data()?.bodyHtml) {
                tSnap = altSnap;
              }
            }
          }

          if (tSnap.exists()) {
            const tData = tSnap.data();
            if (tData?.subject && !customSubject) customSubject = tData.subject;
            if (tData?.bodyHtml || tData?.content || tData?.body) {
              if (!customHtml) customHtml = tData.bodyHtml || tData.content || tData.body;
            }
          }
        } catch (e) {
          console.warn("Could not fetch email template from Firestore:", e);
        }
      }

      let masterLayoutData: any = null;
      try {
        const mlSnap = await getDoc(doc(serverDb, "emailTemplates", "global_master_layout"));
        if (mlSnap.exists()) {
          masterLayoutData = mlSnap.data();
        }
      } catch (mErr) {
        // ignore layout fetch error
      }

      const { subject, html } = buildEmailTemplate(template, {
        ...body,
        customSubject,
        customHtml
      }, masterLayoutData);

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

      await addDoc(collection(serverDb, "emailLogs"), logData);

      res.json({ success: true, message: `تم إرسال إيميل (${template}) بنجاح إلى ${recipientEmail}`, log: logData });
    } catch (err: any) {
      console.error("Error sending email:", err);
      let errorMsg = err.message || 'فشل إرسال الإيميل';

      if (err.message && (err.message.includes('invalid_grant') || err.message.includes('Token has been expired') || err.message.includes('invalid_token'))) {
        errorMsg = "انتهت صلاحية جلسة حساب Google الرسمي (sabergroup.eg@gmail.com). يرجى الذهاب لصفحة Google Integrations والضغط على 'إعادة الربط' لربط الحساب مجدداً.";
        try {
          await updateDoc(doc(serverDb, "googleConnections", "sabergroup_eg_gmail_com"), {
            status: 'reconnect_required',
            updatedAt: new Date().toISOString()
          });
        } catch (uErr) {
          console.error("Failed to mark sabergroup_eg_gmail_com as reconnect_required:", uErr);
        }
      }

      if (recipientEmail) {
        try {
          await addDoc(collection(serverDb, "emailLogs"), {
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
  });

  // Helper function to robustly parse 12h/24h time strings (including Arabic "مساءً" / "صباحاً") to HH:MM start and end times
  function parseTimeToHHMM(timeStr: string | undefined | null, durationMinutes: number = 120): { startHHMM: string, endHHMM: string } {
    if (!timeStr) return { startHHMM: '18:00', endHHMM: '20:00' };

    const str = timeStr.trim().toLowerCase();
    const isPM = str.includes('pm') || str.includes('مساءً') || str.includes('مساء') || str.includes('م');
    const isAM = str.includes('am') || str.includes('صباحاً') || str.includes('صباح') || str.includes('ص');

    const match = str.match(/(\d{1,2}):(\d{2})/);
    if (!match) return { startHHMM: '18:00', endHHMM: '20:00' };

    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);

    if (isPM && hour < 12) {
      hour += 12;
    } else if (isAM && hour === 12) {
      hour = 0;
    }

    const startTotal = (hour % 24) * 60 + (min % 60);
    const endTotal = (startTotal + durationMinutes) % (24 * 60);

    const startH = Math.floor(startTotal / 60);
    const startM = startTotal % 60;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;

    const startHHMM = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
    const endHHMM = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    return { startHHMM, endHHMM };
  }

  // API Endpoint: Send Test Email
  app.post("/api/google/send-test-email", async (req, res) => {
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

      await addDoc(collection(serverDb, "emailLogs"), logData);

      res.json({ success: true, message: `تم إرسال إيميل تجريبي بنجاح إلى ${targetEmail}!`, log: logData });
    } catch (err: any) {
      console.error("Error sending test email:", err);
      res.status(500).json({ error: err.message || 'فشل إرسال الإيميل التجريبي' });
    }
  });

  // API Endpoint: Fetch Email Logs
  app.get("/api/google/email-logs", async (req, res) => {
    try {
      const q = query(collection(serverDb, "emailLogs"), orderBy("sentAt", "desc"), limit(50));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(logs);
    } catch (err: any) {
      console.error("Error fetching email logs:", err);
      res.status(500).json({ error: err.message || "Failed to fetch email logs" });
    }
  });


  // ==========================================
  // PHASE 4: Google Calendar & Meet Sync Service
  // ==========================================

  async function getOrganizerOAuthClient(req: express.Request, preferredEmail?: string, trainerId?: string, forceCentral: boolean = false) {
    let snap: any = null;

    if (forceCentral) {
      const centralRef = doc(serverDb, "googleConnections", "sabergroup_eg_gmail_com");
      snap = await getDoc(centralRef);
      if (!snap.exists() || snap.data()?.status !== 'connected') {
        throw new Error("الحساب الرسمي للنظام (sabergroup.eg@gmail.com) غير مرتبط بعد. يرجى ربطه من صفحة Google Integrations أولاً.");
      }
      const data = snap.data();
      const refreshToken = decryptToken(data.encryptedRefreshToken);
      if (!refreshToken) throw new Error("تعذر فك تشفير توكن الحساب الرسمي للنظام.");
      const oauth2Client = getOAuth2Client(req);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      return { 
        oauth2Client, 
        email: data.googleEmail || data.email || 'sabergroup.eg@gmail.com', 
        displayName: 'SABER GROUP Central', 
        connectionId: snap.id 
      };
    }

    // 1. Try finding Google Connection linked directly to trainerId
    if (trainerId) {
      const trainerDocRef = doc(serverDb, "googleConnections", `trainer_${trainerId}`);
      const trainerSnap = await getDoc(trainerDocRef);
      if (trainerSnap.exists() && trainerSnap.data()?.status === 'connected') {
        snap = trainerSnap;
      } else {
        const qTrainer = query(
          collection(serverDb, "googleConnections"),
          where("trainerId", "==", trainerId),
          where("status", "==", "connected")
        );
        const qSnap = await getDocs(qTrainer);
        if (!qSnap.empty) {
          snap = qSnap.docs[0];
        }
      }
    }

    // 2. Try preferredEmail if passed
    if ((!snap || !snap.exists() || snap.data()?.status !== 'connected') && preferredEmail) {
      const docId = preferredEmail.replace(/[^a-z0-9_]/g, '_');
      const docRef = doc(serverDb, "googleConnections", docId);
      const eSnap = await getDoc(docRef);
      if (eSnap.exists() && eSnap.data()?.status === 'connected') {
        snap = eSnap;
      }
    }

    // If no connected snap found for trainer: throw specific TRAINER_OAUTH_EXPIRED error
    if (!snap || !snap.exists() || snap.data()?.status !== 'connected') {
      const err: any = new Error("حساب Google الخاص بالمدرب غير مرتبط بالنظام أو انتهت صلاحية الجلسة. يمكنك إعادة ربط حساب المدرب أو الجدولة بالبريد المركزي للأكاديمية.");
      err.code = 'TRAINER_OAUTH_EXPIRED';
      throw err;
    }

    const data = snap.data();
    const refreshToken = decryptToken(data.encryptedRefreshToken);
    if (!refreshToken) {
      const err: any = new Error(`تعذر فك تشفير توكن حساب Google للمدرب (${data.googleEmail || data.email || ''}). يرجى إعادة ربط الحساب.`);
      err.code = 'TRAINER_OAUTH_EXPIRED';
      throw err;
    }

    const oauth2Client = getOAuth2Client(req);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return { 
      oauth2Client, 
      email: data.googleEmail || data.email,
      displayName: data.displayName || '',
      connectionId: snap.id || data.id
    };
  }

  // Helper function to record Google Audit Log
  const recordGoogleAuditLog = async (data: {
    action: string;
    operator: string;
    operatorEmail?: string;
    groupId?: string;
    groupName?: string;
    sessionId?: string;
    sessionNumber?: number;
    details: string;
    status: 'success' | 'failed';
    error?: string;
  }) => {
    try {
      await addDoc(collection(serverDb, "googleAuditLogs"), {
        ...data,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Failed to write googleAuditLog:", e);
    }
  };

  // API Endpoint: Get Google Audit Logs
  app.get("/api/google/audit-logs", async (req, res) => {
    try {
      const q = query(collection(serverDb, "googleAuditLogs"));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      logs.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "فشل جلب سجلات التعديلات" });
    }
  });

  // API Endpoint: Record Google Audit Log directly
  app.post("/api/google/record-audit-log", async (req, res) => {
    try {
      const logData = req.body;
      await recordGoogleAuditLog(logData);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "فشل تسجيل الـ Audit Log" });
    }
  });

  // API Endpoint: Reschedule / Update Google Calendar Event for Session (No cancellations in training model)
  app.post("/api/google/reschedule-session-event", async (req, res) => {
    try {
      const { groupId, sessionId, newDate, newTime, organizerEmail, operatorName, operatorEmail, reason } = req.body;
      if (!groupId || !sessionId) {
        return res.status(400).json({ error: "معرف الجروب والمحاضرة مطلوبين." });
      }

      const groupSnap = await getDoc(doc(serverDb, "groups", groupId));
      if (!groupSnap.exists()) {
        return res.status(404).json({ error: "الجروب غير موجود." });
      }
      const group = groupSnap.data();

      const sessionSnap = await getDoc(doc(serverDb, "sessions", sessionId));
      if (!sessionSnap.exists()) {
        return res.status(404).json({ error: "المحاضرة غير موجودة." });
      }
      const session = sessionSnap.data();

      const primaryTrainerId = group.primaryTrainerId || (group.trainerIds && group.trainerIds[0]) || group.supervisorId;
      const targetDate = newDate || session.date || new Date().toISOString().split('T')[0];
      const targetTime = newTime || group.sessionTime || '18:00';

      const { startHHMM, endHHMM } = parseTimeToHHMM(targetTime);

      let updatedCalendarEventId = session.googleCalendarEventId;
      let updatedMeetLink = session.googleMeetLink || session.googleMeetUrl || '';

      if (session.googleCalendarEventId) {
        try {
          const { oauth2Client } = await getOrganizerOAuthClient(req, organizerEmail, primaryTrainerId);
          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

          const rescheduleNote = reason ? `\nسبب الترحيل/التحديث: ${reason}` : '';
          const batchCode = group.batchCode || group.name || 'Group';
          const sessionNum = session.sessionNumber || 1;
          const lectureTitle = session.lectureTitle || `المحاضرة ${sessionNum}`;

          const updateRes: any = await calendar.events.patch({
            calendarId: 'primary',
            eventId: session.googleCalendarEventId,
            sendUpdates: 'none', // Do not spam students; links are in Student Portal
            requestBody: {
              summary: `${batchCode} - المحاضرة ${sessionNum} - ${lectureTitle} (مرحلة/محدثة)`,
              description: `SABER GROUP Training Management System\nالكورس: ${group.courseName || ''}\nتاريخ جديد: ${targetDate}${rescheduleNote}\nرابط بوابة الطالب: https://training.sabergroupacademy.com/#/student-portal`,
              start: { dateTime: `${targetDate}T${startHHMM}:00`, timeZone: 'Africa/Cairo' },
              end: { dateTime: `${targetDate}T${endHHMM}:00`, timeZone: 'Africa/Cairo' }
            }
          });
          updatedMeetLink = updateRes.data?.hangoutLink || updatedMeetLink;
        } catch (calErr: any) {
          console.warn("Could not update Google Calendar event directly:", calErr.message);
        }
      }

      // Update Session Status in Firestore with new date & status
      await updateDoc(doc(serverDb, "sessions", sessionId), {
        date: targetDate,
        dateChangeReason: reason || session.dateChangeReason || '',
        googleSyncStatus: 'synced',
        googleMeetLink: updatedMeetLink,
        googleMeetUrl: updatedMeetLink,
        updatedAt: new Date().toISOString()
      });

      // Record Audit Log
      await recordGoogleAuditLog({
        action: 'Calendar Event Rescheduled',
        operator: operatorName || 'System',
        operatorEmail: operatorEmail || '',
        groupId,
        groupName: group.name,
        sessionId,
        sessionNumber: session.sessionNumber,
        details: `تم ترحيل/تحديث موعد المحاضرة إلى ${targetDate} وتحديث Google Calendar. (${reason || 'ترحيل المحاضرة'})`,
        status: 'success'
      });

      res.json({ success: true, message: "تم ترحيل وتحديث موعد المحاضرة وGoogle Calendar بنجاح." });
    } catch (err: any) {
      console.error("Error rescheduling session event:", err);
      res.status(500).json({ error: err.message || "فشل ترحيل موعد المحاضرة" });
    }
  });

  // API Endpoint: Launch Google Schedule (Phase 4)
  app.post("/api/google/sync-group-calendar", async (req, res) => {
    let organizerAccountEmail = '';
    try {
      const { groupId, organizerEmail, forceRetryOnly, forceCentral, trainerId: reqTrainerId, currentUserId } = req.body;
      if (!groupId) {
        return res.status(400).json({ error: "معرف الجروب (groupId) مطلوب." });
      }

      // Fetch Group Doc
      const groupRef = doc(serverDb, "groups", groupId);
      const groupSnap = await getDoc(groupRef);
      if (!groupSnap.exists()) {
        return res.status(404).json({ error: "الجروب المطلوب غير موجود." });
      }
      const group = groupSnap.data();

      // Fetch Organizer OAuth Client (resolving Trainer's Google Connection or Central Fallback)
      const targetTrainerId = reqTrainerId || currentUserId || group.primaryTrainerId || (group.trainerIds && group.trainerIds[0]) || group.supervisorId;
      
      let oauth2Client: any;
      let googleConnectionId = '';

      try {
        const organizerInfo = await getOrganizerOAuthClient(req, organizerEmail, targetTrainerId, forceCentral === true);
        oauth2Client = organizerInfo.oauth2Client;
        organizerAccountEmail = organizerInfo.email;
        googleConnectionId = organizerInfo.connectionId;
      } catch (oauthErr: any) {
        return res.status(400).json({
          success: false,
          code: 'TRAINER_OAUTH_EXPIRED',
          error: oauthErr.message || "تعذر استخدام حساب Google للمدرب. يمكنك إعادة ربط حساب المدرب أو استخدام الجدولة بالبريد المركزي للاكاديمية.",
          trainerId: targetTrainerId || '',
          trainerEmail: organizerEmail || ''
        });
      }

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Resolve Staff Attendees (Trainers and Supervisor)
      const baseStaffAttendees: { email: string; displayName?: string }[] = [];
      const trainerIds = group.trainerIds || [];
      if (group.primaryTrainerId && !trainerIds.includes(group.primaryTrainerId)) trainerIds.push(group.primaryTrainerId);
      if (group.secondaryTrainerId && !trainerIds.includes(group.secondaryTrainerId)) trainerIds.push(group.secondaryTrainerId);

      for (const tId of trainerIds) {
        try {
          const tSnap = await getDoc(doc(serverDb, "users", tId));
          if (tSnap.exists() && tSnap.data().email) {
            baseStaffAttendees.push({ email: tSnap.data().email, displayName: tSnap.data().name });
          }
        } catch (e) {
          console.warn("Could not fetch trainer email:", tId);
        }
      }

      if (group.supervisorId) {
        try {
          const sSnap = await getDoc(doc(serverDb, "users", group.supervisorId));
          if (sSnap.exists() && sSnap.data().email) {
            baseStaffAttendees.push({ email: sSnap.data().email, displayName: sSnap.data().name });
          }
        } catch (e) {
          console.warn("Could not fetch supervisor email:", group.supervisorId);
        }
      }

      // Fetch Students for this group & categorize by attendanceEmail
      const studentsQuery = query(collection(serverDb, "students"), where("groupId", "==", groupId));
      const studentsSnap = await getDocs(studentsQuery);
      const groupStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validStudentAttendees: { email: string; displayName?: string }[] = [];
      const missingAttendanceEmails: { id: string; name: string; phone?: string; studentIdNum?: string }[] = [];

      for (const st of groupStudents as any[]) {
        const studentEmail = (st.attendanceEmail || st.email || '').trim().toLowerCase();
        if (studentEmail && emailRegex.test(studentEmail)) {
          if (!validStudentAttendees.some(a => a.email.toLowerCase() === studentEmail)) {
            validStudentAttendees.push({
              email: studentEmail,
              displayName: st.name || 'طالب'
            });
          }
        } else {
          missingAttendanceEmails.push({
            id: st.id,
            name: st.name || 'طالب',
            phone: st.phone || '',
            studentIdNum: st.studentIdNum || ''
          });
        }
      }

      const invitationMode = group.calendarInvitationMode || '24h_before';

      // Fetch Sessions for this group
      const sessionsQuery = query(collection(serverDb, "sessions"), where("groupId", "==", groupId));
      const sessionsSnap = await getDocs(sessionsQuery);
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
        sessionsToSync = allSessions.filter((s: any) => s.googleSyncStatus === 'failed' || !s.googleCalendarEventId);
      }

      let succeededCount = 0;
      let failedCount = 0;
      const syncResults: any[] = [];

      for (const session of sessionsToSync as any[]) {
        try {
          // Parse time and date for Africa/Cairo timezone
          const dateStr = session.date || new Date().toISOString().split('T')[0];
          const timeStr = session.time || group.sessionTime || '18:00';
          const { startHHMM, endHHMM } = parseTimeToHHMM(timeStr);

          // Requirement 3: Students get links via Student Portal. Do not add students as attendees or send invitations by default.
          const inviteStudentsToCalendar = req.body.inviteStudentsToCalendar === true || group.inviteStudentsToCalendar === true;
          let includeStudents = inviteStudentsToCalendar;

          const sessionAttendees = [...baseStaffAttendees];
          if (includeStudents && validStudentAttendees.length > 0) {
            for (const stAtt of validStudentAttendees) {
              if (!sessionAttendees.some(a => a.email.toLowerCase() === stAtt.email.toLowerCase())) {
                sessionAttendees.push(stAtt);
              }
            }
          }

          const batchCode = group.batchCode || group.name || 'Group';
          const sessionNum = session.sessionNumber || 1;
          const lectureTitle = session.lectureTitle || `المحاضرة ${sessionNum}`;
          const trainerName = session.actualTrainerName || group.trainerName || group.primaryTrainerName || 'غير محدد';
          const rescheduleNote = session.dateChangeReason ? `\nملاحظة التعديل / الترحيل: ${session.dateChangeReason}` : '';

          const eventTitle = `${batchCode} - المحاضرة ${sessionNum} - ${lectureTitle}`;
          const description = `SABER GROUP Training Management System\nالكورس: ${group.courseName || ''}\nالجروب: ${batchCode}\nالمحاضرة رقم: ${sessionNum}\nالمدرب: ${trainerName}\nرابط بوابة الطالب: https://training.sabergroupacademy.com/#/student-portal${rescheduleNote}`;

          const isOfflineGroup = group.groupType === 'offline';
          const isSessionDone = session.status === 'done';

          const eventPayload: any = {
            summary: eventTitle,
            description,
            location: isOfflineGroup ? 'مقر الأكاديمية (أوفلاين)' : undefined,
            start: {
              dateTime: `${dateStr}T${startHHMM}:00`,
              timeZone: 'Africa/Cairo'
            },
            end: {
              dateTime: `${dateStr}T${endHHMM}:00`,
              timeZone: 'Africa/Cairo'
            },
            attendees: sessionAttendees.length > 0 ? sessionAttendees : undefined
          };

          // Only create Google Meet link for upcoming sessions (not completed/done)
          if (!isSessionDone && (!isOfflineGroup || req.body?.createMeet === true || session.googleMeetUrl || session.meetingLink)) {
            eventPayload.conferenceData = {
              createRequest: {
                requestId: `meet_space_${session.id}_${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' }
              }
            };
          }

          // Send updates setting: 'none' by default so no email invitations are spammed
          const sendUpdatesMode = includeStudents ? 'all' : 'none';

          let calRes: any;
          if (session.googleCalendarEventId) {
            try {
              calRes = await calendar.events.update({
                calendarId: 'primary',
                eventId: session.googleCalendarEventId,
                conferenceDataVersion: 1,
                sendUpdates: sendUpdatesMode,
                requestBody: eventPayload
              });
            } catch (updateErr) {
              calRes = await calendar.events.insert({
                calendarId: 'primary',
                conferenceDataVersion: 1,
                sendUpdates: sendUpdatesMode,
                requestBody: eventPayload
              });
            }
          } else {
            calRes = await calendar.events.insert({
              calendarId: 'primary',
              conferenceDataVersion: 1,
              sendUpdates: sendUpdatesMode,
              requestBody: eventPayload
            });
          }

          const eventId = calRes.data.id;
          const hangoutLink = calRes.data.hangoutLink || calRes.data.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri || '';

          // Update Session Doc in Firestore
          await updateDoc(doc(serverDb, "sessions", session.id), {
            googleCalendarEventId: eventId,
            googleMeetLink: hangoutLink,
            googleConnectionId: googleConnectionId || '',
            googleMeetUrl: hangoutLink,
            meetingLink: hangoutLink || session.meetingLink || '',
            googleSyncStatus: 'synced',
            updatedAt: new Date().toISOString()
          });

          // Record Audit Log
          const isUpdate = !!session.googleCalendarEventId;
          await recordGoogleAuditLog({
            action: isUpdate ? 'Calendar Updated' : 'Calendar Created',
            operator: req.body.operatorName || 'System',
            operatorEmail: req.body.operatorEmail || '',
            groupId,
            groupName: group.name,
            sessionId: session.id,
            sessionNumber: session.sessionNumber,
            details: `تم ${isUpdate ? 'تحديث' : 'إنشاء'} Google Calendar Event للمحاضرة رقم ${session.sessionNumber} (${session.lectureTitle || ''})`,
            status: 'success'
          });

          succeededCount++;
          syncResults.push({ sessionId: session.id, status: 'synced', eventId, hangoutLink });

        } catch (sessionErr: any) {
          console.error(`Error syncing session ${session.id}:`, sessionErr);
          failedCount++;

          if (sessionErr.message && (sessionErr.message.includes('invalid_grant') || sessionErr.message.includes('Token has been expired') || sessionErr.message.includes('invalid_token'))) {
            if (googleConnectionId) {
              try {
                await updateDoc(doc(serverDb, "googleConnections", googleConnectionId), {
                  status: 'reconnect_required',
                  updatedAt: new Date().toISOString()
                });
              } catch (e) {}
            }
          }

          try {
            await updateDoc(doc(serverDb, "sessions", session.id), {
              googleSyncStatus: 'failed',
              updatedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("Failed to set session status to failed:", e);
          }

          // Record Audit Log for error
          await recordGoogleAuditLog({
            action: 'Error',
            operator: req.body.operatorName || 'System',
            operatorEmail: req.body.operatorEmail || '',
            groupId,
            groupName: group.name,
            sessionId: session.id,
            sessionNumber: session.sessionNumber,
            details: `فشل مزامنة Google Calendar للمحاضرة رقم ${session.sessionNumber}: ${sessionErr.message}`,
            status: 'failed',
            error: sessionErr.message
          });

          syncResults.push({ sessionId: session.id, status: 'failed', error: sessionErr.message || 'Sync error' });
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

    } catch (err: any) {
      console.error("Error syncing group calendar:", err);
      const isOAuthError = err.code === 'TRAINER_OAUTH_EXPIRED' ||
                           err.message?.includes('TRAINER_OAUTH_EXPIRED') ||
                           err.message?.includes('invalid_grant') ||
                           err.message?.includes('invalid_token') ||
                           err.message?.includes('غير مرتبط') ||
                           err.message?.includes('انتهت صلاحية');

      if (isOAuthError) {
        return res.status(400).json({
          success: false,
          code: 'TRAINER_OAUTH_EXPIRED',
          error: err.message || 'تعذر الاتصال بـ Google باستخدام حساب المدرب (انتهت صلاحية الجلسة أو غير مرتبط). يمكنك إعادة ربط حساب المدرب أو الجدولة بالبريد المركزي للأكاديمية.',
          trainerEmail: organizerAccountEmail || ''
        });
      }

      res.status(500).json({ error: err.message || "فشل مزامنة المواعيد مع Google Calendar" });
    }
  });

  // API Endpoint: Delete Google Calendar events for a group when deleted or archived
  app.post("/api/google/delete-group-calendar", async (req, res) => {
    try {
      const { groupId } = req.body;
      if (!groupId) {
        return res.status(400).json({ error: "groupId is required" });
      }

      const groupRef = doc(serverDb, "groups", groupId);
      const groupSnap = await getDoc(groupRef);
      const group = groupSnap.exists() ? groupSnap.data() : null;

      const primaryTrainerId = group?.primaryTrainerId || (group?.trainerIds && group?.trainerIds[0]) || group?.supervisorId;
      const { oauth2Client } = await getOrganizerOAuthClient(req, undefined, primaryTrainerId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const sessionsSnap = await getDocs(query(collection(serverDb, "sessions"), where("groupId", "==", groupId)));
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
          } catch (delErr: any) {
            console.warn(`Could not delete calendar event ${s.googleCalendarEventId}:`, delErr.message);
          }
          await updateDoc(doc(serverDb, "sessions", sDoc.id), {
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
        message: `تم حذف (${deletedCount}) من أحداث الكالندر وإلغاؤها للجروب بنجاح.`
      });
    } catch (err: any) {
      console.error("Error deleting group calendar events:", err);
      res.status(500).json({ error: err.message || "فشل حذف المواعيد من Google Calendar" });
    }
  });

  // API Endpoint: Migration for pre-integration sessions (Set googleSyncStatus = 'pending')
  app.post("/api/google/migrate-sessions-status", async (req, res) => {
    try {
      const { groupId } = req.body;
      let q;
      if (groupId) {
        q = query(collection(serverDb, "sessions"), where("groupId", "==", groupId));
      } else {
        q = query(collection(serverDb, "sessions"));
      }

      const snap = await getDocs(q);
      let updatedCount = 0;

      for (const d of snap.docs) {
        const data = d.data() as any;
        if (!data.googleSyncStatus) {
          await updateDoc(doc(serverDb, "sessions", d.id), {
            googleSyncStatus: 'pending',
            updatedAt: new Date().toISOString()
          });
          updatedCount++;
        }
      }

      res.json({
        success: true,
        totalChecked: snap.size,
        updatedCount,
        message: `تم ترقية وتحديث ${updatedCount} محاضرة سابقة بنجاح وإسناد الحالة (pending).`
      });
    } catch (err: any) {
      console.error("Migration error:", err);
      res.status(500).json({ error: err.message || "فشل ترقية المحاضرات" });
    }
  });

  // Handle unmatched API routes with JSON 404 instead of falling through to SPA HTML fallback
  app.use("/api", (req, res) => {
    res.status(404).json({ error: `مسار الـ API غير موجود: ${req.method} ${req.originalUrl}` });
  });

  // Global API Error Handler Middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      console.error("[API Error Handler]:", err);
      return res.status(500).json({ error: err.message || "حدث خطأ غير متوقع في الخادم (API Error)" });
    }
    next(err);
  });

  // Serve static files / Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Fullstack Server] Activated on http://localhost:${PORT}`);
  });
}

startServer();
