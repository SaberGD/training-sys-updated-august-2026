/**
 * SABER GROUP COURSES ACADEMY - Premium Email Template Design System
 * Adobe Certified Training Academy Visual Identity
 */

export interface EmailData {
  studentName?: string;
  courseName?: string;
  groupCode?: string;
  groupId?: string;
  groupName?: string;
  batchCode?: string;
  trainerName?: string;
  sessionNumber?: number | string;
  lectureTitle?: string;
  date?: string;
  time?: string;
  oldDate?: string;
  old_date?: string;
  new_date?: string;
  studentIdNum?: string;
  studentId?: string;
  studentPassword?: string;
  meetLink?: string;
  portalLink?: string;
  reason?: string;
  announcementContent?: string;
  announcement_content?: string;
  message?: string;
  customSubject?: string;
  customHtml?: string;
  customContent?: string;
  bodyHtml?: string;
  [key: string]: any;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export interface MasterEmailLayout {
  academyTitle?: string;
  academySubtitleBadge?: string;
  logoUrl?: string;
  headerBgGradient?: string;
  accentGlowColor?: string;
  customHeaderHtml?: string;
  footerTitle?: string;
  footerSubtitle?: string;
  footerSupportText?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
  copyrightText?: string;
  customFooterHtml?: string;
}

export const DEFAULT_MASTER_EMAIL_LAYOUT: MasterEmailLayout = {
  academyTitle: 'SABER GROUP COURSES ACADEMY',
  academySubtitleBadge: '✦ ADOBE AUTHORIZED TRAINING ACADEMY ✦',
  logoUrl: 'https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp',
  headerBgGradient: 'linear-gradient(135deg, #0D0D0D 0%, #2A0000 50%, #620000 100%)',
  accentGlowColor: '#FF8900',
  customHeaderHtml: '',
  footerTitle: 'SABER GROUP COURSES ACADEMY',
  footerSubtitle: 'Official Training Management System',
  footerSupportText: 'هل تحتاج إلى مساعدة أو لديك استفسار؟ تواصل مع إدارة الأكاديمية عبر القنوات الرسمية',
  facebookUrl: 'https://www.facebook.com/SABERGROUP.Courses',
  instagramUrl: 'https://www.instagram.com/sabergroup.egc/',
  whatsappUrl: 'https://wa.me/201040784390',
  copyrightText: 'جميع الحقوق محفوظة © Eng. Mohamed Saber - SABER GROUP COURSES ACADEMY\nAdobe Certified Training Academy',
  customFooterHtml: ''
};

/**
 * Main Email Wrapper Frame
 */
export function wrapInSaberEmailFrame(
  heroTitle: string, 
  heroSubtitle: string, 
  bodyContent: string,
  customLayout?: MasterEmailLayout
): string {
  const layout = { ...DEFAULT_MASTER_EMAIL_LAYOUT, ...(customLayout || {}) };

  const logo = layout.logoUrl || 'https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp';
  const accent = layout.accentGlowColor || '#FF8900';
  const bgGrad = layout.headerBgGradient || 'linear-gradient(135deg, #0D0D0D 0%, #2A0000 50%, #620000 100%)';
  const academyTitle = layout.academyTitle || 'SABER GROUP COURSES ACADEMY';
  const badge = layout.academySubtitleBadge || '✦ ADOBE AUTHORIZED TRAINING ACADEMY ✦';

  const footerTitle = layout.footerTitle || 'SABER GROUP COURSES ACADEMY';
  const footerSub = layout.footerSubtitle || 'Official Training Management System';
  const supportText = layout.footerSupportText || 'هل تحتاج إلى مساعدة أو لديك استفسار؟ تواصل مع إدارة الأكاديمية عبر القنوات الرسمية';
  const fbUrl = layout.facebookUrl || 'https://www.facebook.com/SABERGROUP.Courses';
  const instaUrl = layout.instagramUrl || 'https://www.instagram.com/sabergroup.egc/';
  const waUrl = layout.whatsappUrl || 'https://wa.me/201040784390';
  const copyText = (layout.copyrightText || 'جميع الحقوق محفوظة © Eng. Mohamed Saber - SABER GROUP COURSES ACADEMY').replace(/\n/g, '<br/>');

  const customHeader = layout.customHeaderHtml ? `<div style="margin-top:15px;">${layout.customHeaderHtml}</div>` : '';
  const customFooter = layout.customFooterHtml ? `<div style="margin-bottom:15px;">${layout.customFooterHtml}</div>` : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${academyTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F6F8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F4F6F8; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.08); border: 1px solid #E2E8F0;">
          
          <!-- HERO HEADER -->
          <tr>
            <td style="background: ${bgGrad}; padding: 36px 28px; text-align: center; position: relative;">
              <!-- Official Logo -->
              ${logo ? `<img src="${logo}" width="165" alt="${academyTitle}" style="display:block;margin:auto;margin-bottom:20px;max-height:80px;object-fit:contain;" />` : ''}

              <!-- Accent Glow Bar -->
              <div style="height: 4px; background: ${accent}; border-radius: 2px; margin-bottom:20px;"></div>

              <!-- Badge -->
              ${badge ? `
              <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px auto;">
                <tr>
                  <td style="background-color: rgba(255, 137, 0, 0.15); border: 1px solid ${accent}; padding: 6px 18px; border-radius: 50px;">
                    <span style="color: ${accent}; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
                      ${badge}
                    </span>
                  </td>
                </tr>
              </table>` : ''}

              <!-- Main Academy Title -->
              <h1 style="color: #FFFFFF; font-size: 23px; font-weight: 900; margin: 0 0 4px 0; letter-spacing: -0.5px; line-height: 1.2;">
                ${academyTitle}
              </h1>

              <!-- Email Specific Title -->
              ${heroTitle ? `
              <div style="color: ${accent}; font-size: 18px; font-weight: 800; margin-top: 12px; line-height: 1.3;">
                ${heroTitle}
              </div>` : ''}

              ${heroSubtitle ? `
              <div style="color: #CBD5E1; font-size: 13px; font-weight: 500; margin-top: 6px;">
                ${heroSubtitle}
              </div>` : ''}

              ${customHeader}
            </td>
          </tr>

          <!-- MAIN BODY CONTENT -->
          <tr>
            <td style="padding: 36px 32px; background-color: #FFFFFF;">
              ${bodyContent}
            </td>
          </tr>

          <!-- BRANDED FOOTER -->
          <tr>
            <td style="background-color: #0D0D0D; padding: 36px 32px; text-align: center; border-top: 3px solid ${accent};">
              ${customFooter}

              <div style="color: #FFFFFF; font-size: 16px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 4px;">
                ${footerTitle}
              </div>
              <div style="color: ${accent}; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-bottom: 18px; text-transform: uppercase;">
                ${footerSub}
              </div>

              ${supportText ? `
              <div style="color: #94A3B8; font-size: 12px; margin-bottom: 20px;">
                ${supportText}
              </div>` : ''}

              <!-- Social Media Badges -->
              <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 24px auto;">
                <tr>
                  ${fbUrl ? `
                  <td style="padding: 0 5px;">
                    <a href="${fbUrl}" target="_blank" style="display: inline-block; background-color: #1A1A1A; border: 1px solid #333333; border-radius: 10px; padding: 8px 14px; color: #FFFFFF; text-decoration: none; font-size: 12px; font-weight: 700;">
                      <span style="color: #1877F2; margin-left: 4px; font-weight: 900;">f</span> Facebook
                    </a>
                  </td>` : ''}
                  ${instaUrl ? `
                  <td style="padding: 0 5px;">
                    <a href="${instaUrl}" target="_blank" style="display: inline-block; background-color: #1A1A1A; border: 1px solid #333333; border-radius: 10px; padding: 8px 14px; color: #FFFFFF; text-decoration: none; font-size: 12px; font-weight: 700;">
                      <span style="color: #E4405F; margin-left: 4px; font-weight: 900;">📷</span> Instagram
                    </a>
                  </td>` : ''}
                  ${waUrl ? `
                  <td style="padding: 0 5px;">
                    <a href="${waUrl}" target="_blank" style="display: inline-block; background-color: #1A1A1A; border: 1px solid #333333; border-radius: 10px; padding: 8px 14px; color: #FFFFFF; text-decoration: none; font-size: 12px; font-weight: 700;">
                      <span style="color: #25D366; margin-left: 4px; font-weight: 900;">💬</span> WhatsApp
                    </a>
                  </td>` : ''}
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #262626; margin: 20px 0;" />

              <p style="font-size: 11px; color: #666666; margin: 0; line-height: 1.6;">
                ${copyText}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Reusable Component: Info Row
 */
export function renderInfoRow(label: string, value: string, highlightColor: string = '#0D0D0D'): string {
  return `
    <tr style="border-bottom: 1px dashed #E2E8F0;">
      <td style="padding: 10px 0; font-size: 13px; color: #64748B; font-weight: 600;">${label}:</td>
      <td style="padding: 10px 0; font-size: 14px; color: ${highlightColor}; font-weight: 800; text-align: left;" dir="ltr">${value}</td>
    </tr>
  `;
}

/**
 * Reusable Component: CTA Button
 */
export function renderCTAButton(label: string, link: string, primaryColor: string = '#FF8900'): string {
  return `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 16px 0;">
      <tr>
        <td align="center">
          <a href="${link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, #D97300 100%); color: #FFFFFF; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 36px; border-radius: 14px; box-shadow: 0 10px 25px -5px rgba(255, 137, 0, 0.4); letter-spacing: 0.3px;">
            ${label} ←
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Render complete template by ID and Data
 */
export function buildSaberEmailTemplate(template: string, data: EmailData, masterLayout?: MasterEmailLayout): RenderedEmail {
  const studentName = data.studentName || 'المتدرب العزيز';
  const courseName = data.courseName || 'الكورس التدريبي';
  const groupCode = data.groupCode || data.group_name || data.group_code || data.groupId || 'الجروب التدريبي';
  const batchCode = data.batchCode || data.batch_code || groupCode;
  const trainerName = data.trainerName || data.trainer_name || 'م. صابر عبد الدايم';
  const sessionNumber = data.sessionNumber || data.session_number || 1;
  const date = data.date || data.session_date || data.new_date || 'اليوم';
  const time = data.time || data.session_time || 'في الموعد المحدد';
  const studentPortalUrl = data.portalLink || data.portal_link || 'https://training.sabergroupacademy.com/#/student/portal';

  let subject = '';
  let heroTitle = '';
  let heroSubtitle = '';
  let bodyHtml = '';

  // Handle custom dynamic template or override from Firestore
  if (data.customSubject && (data.customHtml || data.customContent || data.bodyHtml)) {
    subject = data.customSubject;
    let customBody = data.customHtml || data.customContent || data.bodyHtml || '';

    const studentIdVal = data.studentIdNum || data.studentId || '{student_id}';
    const studentPasswordVal = data.studentPassword || '{student_password}';

    const vars: Record<string, string> = {
      '{student_name}': studentName,
      '{course_name}': courseName,
      '{group_name}': groupCode,
      '{group_code}': groupCode,
      '{batch_code}': batchCode,
      '{student_id}': studentIdVal,
      '{student_password}': studentPasswordVal,
      '{session_number}': String(sessionNumber),
      '{lecture_title}': data.lectureTitle || data.lecture_title || `المحاضرة رقم ${sessionNumber}`,
      '{old_date}': data.oldDate || data.old_date || 'الموعد السابق',
      '{new_date}': date,
      '{session_date}': date,
      '{session_time}': time,
      '{trainer_name}': trainerName,
      '{meet_link}': data.meetLink || data.meet_link || 'https://meet.google.com',
      '{portal_link}': studentPortalUrl,
      '{ai_link}': data.aiLink || data.ai_link || 'https://ai.sabergroupacademy.com/',
      '{facebook_post_link}': data.facebookPostLink || data.facebook_post_link || 'https://www.facebook.com/photo/?fbid=1014941958047609&set=a.149461877928959',
      '{reason}': data.reason || 'تحديث جدول المحاضرات',
      '{announcement_content}': (data.announcementContent || data.announcement_content || data.message || '').replace(/\n/g, '<br/>'),
      '{facebook_link}': 'https://www.facebook.com/SABERGROUP.Courses',
      '{instagram_link}': 'https://www.instagram.com/sabergroup.egc/',
      '{whatsapp_link}': 'https://wa.me/201040784390',
      'YOUR_LOGO': 'https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp',
      '{logo}': 'https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp',
      '{logo_url}': 'https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp'
    };

    customBody = customBody.replace(/src=["']YOUR_LOGO["']/gi, 'src="https://i.ibb.co/0RNdzJKZ/wallpaper-copy.webp"');

    for (const [key, val] of Object.entries(vars)) {
      subject = subject.replaceAll(key, val);
      customBody = customBody.replaceAll(key, val);
    }

    // Auto-fix for Welcome templates missing credentials ({student_id} or {student_password})
    const isWelcomeEmail = template === 'welcome' || template === 'welcome_group' || customBody.includes('صابر جروب') || customBody.includes('أسرّتنا التدريبية') || customBody.includes('انضمامك');
    const hasLoginCredentials = customBody.includes('بيانات تسجيل الدخول') || customBody.includes('كود الطالب') || customBody.includes('🔑 ID:') || customBody.includes('Password:') || (Boolean(studentIdVal) && studentIdVal !== '{student_id}' && customBody.includes(studentIdVal));

    if (isWelcomeEmail && !hasLoginCredentials) {
      const credentialsBox = `
        <!-- Auto-Injected Login Credentials Card -->
        <div style="background: #FFFFFF; border: 2px solid #FF8900; border-radius: 18px; padding: 20px; margin: 18px 0; box-shadow: 0 8px 20px -4px rgba(255, 137, 0, 0.15); text-align: right;" dir="rtl">
          <div style="font-size: 15px; font-weight: 800; color: #0D0D0D; margin-bottom: 12px; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px;">
            🔑 بيانات تسجيل الدخول إلى بوابة الطالب (Student Portal):
          </div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 10px 14px; background-color: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0;" width="48%">
                <span style="font-size: 11px; color: #64748B; font-weight: 700; display: block; margin-bottom: 2px;">كود الطالب (ID)</span>
                <span style="font-size: 15px; font-weight: 900; color: #0D0D0D; font-family: monospace;">${studentIdVal}</span>
              </td>
              <td width="4%"></td>
              <td style="padding: 10px 14px; background-color: #F8FAFC; border-radius: 12px; border: 1px solid #E2E8F0;" width="48%">
                <span style="font-size: 11px; color: #64748B; font-weight: 700; display: block; margin-bottom: 2px;">كلمة السر (Password)</span>
                <span style="font-size: 15px; font-weight: 900; color: #620000; font-family: monospace;">${studentPasswordVal}</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="background-color: #FEF2F2; border: 1.5px solid #FECDD3; border-radius: 14px; padding: 14px 16px; margin-bottom: 18px; text-align: right;" dir="rtl">
          <p style="margin: 0; font-size: 12px; color: #991B1B; font-weight: 800; line-height: 1.5;">⚠️ تحذير أمني هام: برجاء عدم مشاركة الـ ID أو كلمة السر الخاصة بك مع أي شخص إطلاقاً لضمان أمان حسابك وحفظ سجل حضورك وتطبيقك.</p>
        </div>
      `;

      if (customBody.includes('<!-- CREDENTIALS_PLACEHOLDER -->')) {
        customBody = customBody.replace('<!-- CREDENTIALS_PLACEHOLDER -->', credentialsBox);
      } else if (customBody.includes('<a href=')) {
        const linkIndex = customBody.indexOf('<a href=');
        const lastDivBeforeLink = customBody.lastIndexOf('<div', linkIndex);
        if (lastDivBeforeLink !== -1 && linkIndex - lastDivBeforeLink < 150) {
          customBody = customBody.slice(0, lastDivBeforeLink) + credentialsBox + customBody.slice(lastDivBeforeLink);
        } else {
          customBody = customBody.slice(0, linkIndex) + credentialsBox + customBody.slice(linkIndex);
        }
      } else {
        customBody = customBody + credentialsBox;
      }
    }

    // If customBody is already a complete HTML doc or contains full Saber Group branding frame, use it directly
    if (customBody.includes('<!DOCTYPE') || customBody.includes('<html') || customBody.includes('SABER GROUP COURSES ACADEMY') || customBody.includes('wallpaper-copy.webp') || customBody.includes('border-radius: 24px')) {
      return { subject, html: customBody };
    }

    heroTitle = subject;
    heroSubtitle = `${courseName} - ${groupCode}`;
    bodyHtml = customBody;

    return {
      subject,
      html: wrapInSaberEmailFrame(heroTitle, heroSubtitle, bodyHtml, masterLayout)
    };
  }

  switch (template) {
    case 'ai_assistant_invitation':
    case 'maro_ai_invitation': {
      subject = `🤖 دعوة خاصة لتجربة المساعد الذكي الجديد MARO AI | SABER GROUP`;
      heroTitle = '🤖 المساعد الذكي الجديد MARO AI بين يديك الآن';
      heroSubtitle = `${courseName} — الجروب ${groupCode}`;

      const studentIdVal = data.studentIdNum || data.studentId || '{student_id}';
      const studentPasswordVal = data.studentPassword || '{student_password}';
      const aiUrl = data.aiLink || data.ai_link || 'https://ai.sabergroupacademy.com/';
      const fbPostUrl = data.facebookPostLink || data.facebook_post_link || 'https://www.facebook.com/photo/?fbid=1014941958047609&set=a.149461877928959';

      bodyHtml = `
        <!-- Welcome Greeting -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 800; color: #0D0D0D;">
            عزيزي الطالب <span style="color: #620000;">${studentName}</span> 👋
          </p>
          <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.7;">
            سُعداء بدعوتك الرسمية لتجربة <strong>المساعد الذكي الجديد MARO AI</strong> الخاص بأكاديمية <strong>SABER GROUP</strong>! المنصة الذكية مصممة لمساعدتك والإجابة على كل استفساراتك التقنية وتفاصيل مسارك التدريبي ومواعيدك على مدار الساعة.
          </p>
        </div>

        <!-- Credentials Card -->
        <div style="background: #FFFFFF; border: 2px solid #FF8900; border-radius: 20px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(255, 137, 0, 0.12);">
          <div style="font-size: 15px; font-weight: 800; color: #0D0D0D; margin-bottom: 16px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
            🔑 بيانات تسجيل الدخول الخاصة بك:
          </div>
          
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
            <tr>
              <td style="padding: 12px 16px; background-color: #F8FAFC; border-radius: 14px; border: 1px solid #E2E8F0;" width="48%">
                <span style="font-size: 12px; color: #64748B; font-weight: 700; display: block; margin-bottom: 4px;">كود الطالب (ID)</span>
                <span style="font-size: 16px; font-weight: 900; color: #0D0D0D; font-family: monospace;">${studentIdVal}</span>
              </td>
              <td width="4%"></td>
              <td style="padding: 12px 16px; background-color: #F8FAFC; border-radius: 14px; border: 1px solid #E2E8F0;" width="48%">
                <span style="font-size: 12px; color: #64748B; font-weight: 700; display: block; margin-bottom: 4px;">كلمة السر (Password)</span>
                <span style="font-size: 16px; font-weight: 900; color: #620000; font-family: monospace;">${studentPasswordVal}</span>
              </td>
            </tr>
          </table>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748B; line-height: 1.5;">
            * يمكنك استخدام هذه البيانات للدخول إلى المساعد الذكي وبوابة الطالب.
          </p>
        </div>

        <!-- Requirements & Instructions Box -->
        <div style="background-color: #FFF7ED; border: 1.5px solid #FFEDD5; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px;">
          <div style="font-size: 15px; font-weight: 900; color: #C2410C; margin-bottom: 12px; border-bottom: 1px dashed #FDBA74; padding-bottom: 8px;">
            📌 شروط وتعليمات هامة للطلاب والمتدربين:
          </div>
          
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; font-weight: 800; color: #9A3412; margin-bottom: 6px;">
              1️⃣ للطلاب في الجروبات الشغالة حالياً:
            </div>
            <p style="margin: 0; font-size: 13px; color: #7C2D12; line-height: 1.7;">
              • يجب أن تكون مسجلاً في جروب شغال حالياً ومُلتزماً بالحضور.<br>
              • قم بعمل مشاركة (Share) لبوست الأكاديمية على فيسبوك وإرسال <strong>سكرين شوت من الشير</strong> الخاص بك على الفيسبوك للبوست التالي:
              <a href="${fbPostUrl}" target="_blank" style="color: #EA580C; font-weight: 800; text-decoration: underline; margin-right: 4px;">رابط بوست الأكاديمية على فيسبوك</a><br>
              • قم بإرسال <strong>سكرين شوت تثبت تواجدك بالجروب الشغال حالياً</strong>.
            </p>
          </div>

          <div>
            <div style="font-size: 14px; font-weight: 800; color: #9A3412; margin-bottom: 6px;">
              2️⃣ للطلاب الخريجين (الذين أنهوا الكورس):
            </div>
            <p style="margin: 0; font-size: 13px; color: #7C2D12; line-height: 1.7;">
              • إذا كان جروبك قد أنهى الكورس، يجب أن تكون حاصلاً على <strong>الشهادة الخاصة بالكورس</strong> وإرسال <strong>سكرين شوت من الشهادة الخاص بك</strong> (أو سكرين شوت من الجروب الحالي إن كان شغالاً).
            </p>
          </div>
        </div>

        <!-- CTA Buttons Grid -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 16px 0;">
          <tr>
            <td align="center" width="48%">
              <a href="${aiUrl}" target="_blank" style="display: block; background: linear-gradient(135deg, #FF8900 0%, #D97300 100%); color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 15px 18px; border-radius: 14px; text-align: center; box-shadow: 0 10px 25px -5px rgba(255, 137, 0, 0.4);">
                🤖 تجربة المساعد MARO AI
              </a>
            </td>
            <td width="4%"></td>
            <td align="center" width="48%">
              <a href="${fbPostUrl}" target="_blank" style="display: block; background: linear-gradient(135deg, #1877F2 0%, #0F52BA 100%); color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 15px 18px; border-radius: 14px; text-align: center; box-shadow: 0 10px 25px -5px rgba(24, 119, 242, 0.4);">
                📌 رابط بوست الفيسبوك
              </a>
            </td>
          </tr>
        </table>
      `;
      break;
    }

    case 'welcome':
    case 'welcome_group': {
      subject = `مرحباً بك في ${groupCode} - ${courseName} | SABER GROUP COURSES ACADEMY`;
      heroTitle = '🎉 مرحباً بك في أسرّتنا التدريبية';
      heroSubtitle = `${courseName} — الجروب ${groupCode}`;

      const studentIdVal = data.studentIdNum || data.studentId || '{student_id}';
      const studentPasswordVal = data.studentPassword || '{student_password}';

      bodyHtml = `
        <!-- Greeting Card -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0D0D0D;">
            عزيزي الطالب <span style="color: #620000;">${studentName}</span> 👋
          </p>
          <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            يسعدنا جداً انضمامك رسمياً إلى كورس <strong>${courseName}</strong> - جروب <strong>${groupCode}</strong> بالأكاديمية.
          </p>
        </div>

        <!-- Credentials Card -->
        <div style="background: #FFFFFF; border: 2px solid #FF8900; border-radius: 20px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(255, 137, 0, 0.12);">
          <div style="font-size: 15px; font-weight: 800; color: #0D0D0D; margin-bottom: 16px; border-bottom: 1px solid #F1F5F9; padding-bottom: 12px;">
            🔑 بيانات تسجيل الدخول إلى بوابة الطالب الرسمية:
          </div>
          
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
            <tr>
              <td style="padding: 12px 16px; background-color: #F8FAFC; border-radius: 14px; border: 1px solid #E2E8F0;" width="48%">
                <span style="font-size: 12px; color: #64748B; font-weight: 700; display: block; margin-bottom: 4px;">كود الطالب (ID)</span>
                <span style="font-size: 16px; font-weight: 900; color: #0D0D0D; font-family: monospace;">${studentIdVal}</span>
              </td>
              <td width="4%"></td>
              <td style="padding: 12px 16px; background-color: #F8FAFC; border-radius: 14px; border: 1px solid #E2E8F0;" width="48%">
                <span style="font-size: 12px; color: #64748B; font-weight: 700; display: block; margin-bottom: 4px;">كلمة السر (Password)</span>
                <span style="font-size: 16px; font-weight: 900; color: #620000; font-family: monospace;">${studentPasswordVal}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Security Warning Box -->
        <div style="background-color: #FEF2F2; border: 1.5px solid #FECDD3; border-radius: 18px; padding: 18px 20px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; color: #991B1B; font-weight: 800; line-height: 1.6;">
            ⚠️ تحذير أمني هام جداً: يُمنع تداول أو مشاركة الـ ID وكلمة السر الخاصة بك مع أي شخص آخر إطلاقاً، وذلك لضمان سرية حسابك الشخصي وحفظ تقييماتك وحضورك في الأكاديمية.
          </p>
        </div>

        <!-- Group Info Card -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 18px; padding: 20px; margin-bottom: 24px;">
          <div style="font-size: 13px; font-weight: 800; color: #0D0D0D; margin-bottom: 12px;">تفاصيل الدفعة والمدرب:</div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            ${renderInfoRow('كود الدفعة / الجروب', batchCode, '#620000')}
            ${renderInfoRow('المدرب الأساسي', trainerName, '#FF8900')}
          </table>
        </div>

        <p style="font-size: 14px; color: #475569; line-height: 1.6; text-align: center; margin-bottom: 20px;">
          يمكنك الآن متابعة جدول المحاضرات، تسجيل الحضور، وتحميل التطبيقات والملفات عبر بوابة الطالب.
        </p>

        <!-- CTA Button -->
        ${renderCTAButton('الانتقال فوراً لبوابة الطالب', studentPortalUrl)}
      `;
      break;
    }

    case 'session_reminder': {
      subject = `تذكير بموعد المحاضرة رقم (${sessionNumber}) | كورس ${courseName}`;
      heroTitle = `⏰ تذكير بموعد المحاضرة رقم (${sessionNumber})`;
      heroSubtitle = `${courseName} — الجروب ${groupCode}`;

      const meetUrl = data.meetLink || data.meet_link || 'https://meet.google.com';

      bodyHtml = `
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0D0D0D;">
            أهلاً بك <span style="color: #620000;">${studentName}</span> 👋
          </p>
          <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            نود تذكيرك بموعد المحاضرة القادمة رقم <strong>(${sessionNumber})</strong> للجروب <strong>${groupCode}</strong>.
          </p>
        </div>

        <!-- Session Schedule Details Card -->
        <div style="background: #FFFFFF; border: 2px solid #FF8900; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(255, 137, 0, 0.12);">
          <div style="font-size: 15px; font-weight: 800; color: #0D0D0D; margin-bottom: 14px;">📅 تفاصيل موعد المحاضرة:</div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            ${renderInfoRow('التاريخ', date, '#0D0D0D')}
            ${renderInfoRow('الوقت والتوقيت', time, '#FF8900')}
            ${renderInfoRow('المدرب المحاضر', trainerName, '#620000')}
          </table>
        </div>

        <!-- Buttons Grid -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
          <tr>
            <td align="center" width="48%">
              <a href="${meetUrl}" target="_blank" style="display: block; background: linear-gradient(135deg, #16A34A 0%, #15803D 100%); color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 15px 20px; border-radius: 14px; text-align: center; box-shadow: 0 8px 20px -4px rgba(22, 163, 74, 0.4);">
                🎥 دخول Google Meet
              </a>
            </td>
            <td width="4%"></td>
            <td align="center" width="48%">
              <a href="${studentPortalUrl}" target="_blank" style="display: block; background: linear-gradient(135deg, #FF8900 0%, #D97300 100%); color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 15px 20px; border-radius: 14px; text-align: center; box-shadow: 0 8px 20px -4px rgba(255, 137, 0, 0.4);">
                🎓 بوابة الطالب
              </a>
            </td>
          </tr>
        </table>
      `;
      break;
    }

    case 'session_changed': {
      subject = `تحديث هام: تغيير موعد المحاضرة رقم (${sessionNumber}) | ${courseName}`;
      heroTitle = `📅 تعديل / ترحيل موعد المحاضرة رقم (${sessionNumber})`;
      heroSubtitle = `${courseName} — الجروب ${groupCode}`;

      const oldDateVal = data.oldDate || data.old_date || 'الموعد السابق';
      const newDateVal = date;
      const reasonVal = data.reason || 'تحديث جدول المحاضرات المعتمد';

      bodyHtml = `
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0D0D0D;">
            عزيزي الطالب <span style="color: #620000;">${studentName}</span> 👋
          </p>
          <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            يرجى العلم بأنه تم تغيير وتعديل موعد <strong>المحاضرة رقم (${sessionNumber})</strong> الخاصة بالجروب <strong>${groupCode}</strong>.
          </p>
        </div>

        <!-- Comparison Cards (Old vs New) -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
          <tr>
            <td width="48%" style="background-color: #FEF2F2; border: 1.5px solid #FECDD3; border-radius: 18px; padding: 16px; text-align: center; vertical-align: top;">
              <span style="font-size: 11px; font-weight: 800; color: #991B1B; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                ❌ الموعد السابق (الملغى)
              </span>
              <span style="font-size: 14px; font-weight: 700; color: #B91C1C; text-decoration: line-through;">
                ${oldDateVal}
              </span>
            </td>
            <td width="4%"></td>
            <td width="48%" style="background-color: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 18px; padding: 16px; text-align: center; vertical-align: top;">
              <span style="font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                ✨ الموعد الجديد (المعتمد)
              </span>
              <span style="font-size: 15px; font-weight: 900; color: #15803D;">
                ${newDateVal}
              </span>
            </td>
          </tr>
        </table>

        <!-- Reason Card -->
        <div style="background-color: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 18px; padding: 16px 20px; margin-bottom: 24px;">
          <span style="font-size: 12px; font-weight: 800; color: #C2410C; display: block; margin-bottom: 4px;">💬 سبب التعديل:</span>
          <span style="font-size: 14px; color: #7C2D12; font-weight: 700;">${reasonVal}</span>
        </div>

        ${renderCTAButton('متابعة الجدول من بوابة الطالب', studentPortalUrl)}
      `;
      break;
    }

    case 'absence_notification':
    case 'absence_alert': {
      subject = `تنبيه غياب: المحاضرة رقم (${sessionNumber}) | SABER GROUP`;
      heroTitle = `⚠️ تنبيه تسجيل غياب عن المحاضرة`;
      heroSubtitle = `${courseName} — الجروب ${groupCode}`;

      bodyHtml = `
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0D0D0D;">
            عزيزي الطالب <span style="color: #620000;">${studentName}</span> 👋
          </p>
          <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            نحيطك علماً بأنه تم تسجيل غيابك عن <strong>المحاضرة رقم (${sessionNumber})</strong> للجروب <strong>${groupCode}</strong> التي أقيمت بتاريخ <strong>${date}</strong>.
          </p>
        </div>

        <div style="background-color: #FEF2F2; border: 1.5px solid #FECDD3; border-radius: 18px; padding: 20px; margin-bottom: 24px;">
          <div style="font-size: 14px; font-weight: 800; color: #991B1B; margin-bottom: 6px;">
            ⚠️ تنبيه هام حول الحضور والشهادات:
          </div>
          <p style="margin: 0; font-size: 13px; color: #B91C1C; line-height: 1.6;">
            حضور المحاضرات والتطبيق العملي المستمر هو شرط أساسي للتفوق والحصول على شهادة الأكاديمية. يرجى مشاهدة تسجيل المحاضرة وتسليم التكليف المطلوب فوراً لتدارك ما فاتك.
          </p>
        </div>

        ${renderCTAButton('مشاهدة تسجيلة المحاضرة والتكليف', studentPortalUrl, '#DC2626')}
      `;
      break;
    }

    case 'trainer_announcement': {
      subject = `📢 تنويه هام من المدرب ${trainerName} - ${courseName} | ${groupCode}`;
      heroTitle = `📢 إعلان هام من مدرب الجروب`;
      heroSubtitle = `${courseName} — الجروب ${groupCode}`;

      const announcementMsg = (data.announcementContent || data.announcement_content || data.message || 'تنويه هام للطلاب').replace(/\n/g, '<br/>');

      bodyHtml = `
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0D0D0D;">
            عزيزي الطالب <span style="color: #620000;">${studentName}</span> 👋
          </p>
          <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            وجه المدرب <strong>${trainerName}</strong> التنويه التالي لجميع طلاب الجروب:
          </p>
        </div>

        <!-- Message Card -->
        <div style="background-color: #FFFFFF; border: 2px solid #FF8900; border-radius: 20px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(255, 137, 0, 0.12); font-size: 14px; color: #0D0D0D; line-height: 1.8;">
          ${announcementMsg}
        </div>

        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 18px; padding: 18px; margin-bottom: 24px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            ${renderInfoRow('المدرب المسؤول', trainerName, '#FF8900')}
            ${renderInfoRow('كود الدفعة / الجروب', batchCode, '#620000')}
          </table>
        </div>

        ${renderCTAButton('الانتقال إلى بوابة الطالب', studentPortalUrl)}
      `;
      break;
    }

    case 'weekly_report': {
      subject = `التقرير الأسبوعي لمتابعة الأداء | ${courseName}`;
      heroTitle = `📊 التقرير الأسبوعي لمتابعة الأداء`;
      heroSubtitle = `${courseName} — الجروب ${groupCode}`;

      bodyHtml = `
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 20px; padding: 22px 24px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #0D0D0D;">
            عزيزي الطالب <span style="color: #620000;">${studentName}</span> 👋
          </p>
          <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            إليك التقرير الأسبوعي المحدث لمتابعة أدائك وحضورك وتكليفاتك بكورس <strong>${courseName}</strong> حتى تاريخ ${date}.
          </p>
        </div>

        ${renderCTAButton('فتح التقرير التفصيلي من البوابة', studentPortalUrl, '#16A34A')}
      `;
      break;
    }

    case 'test':
    default: {
      subject = `إيميل تجريبي لاختبار ربط النظام | SABER GROUP`;
      heroTitle = `🚀 اختبار نظام الإيميلات الرسمي`;
      heroSubtitle = `SABER GROUP Automated Mail Service`;

      bodyHtml = `
        <div style="background-color: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 20px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 16px; font-weight: 900; color: #15803D; margin-bottom: 8px;">
            ✅ النظام متصل ويعمل بكفاءة عالية!
          </div>
          <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.6;">
            تم إرسال هذا الإيميل بنجاح عبر الحساب المركزي المعتمد للأكاديمية (<strong style="font-family: monospace;">sabergroup.eg@gmail.com</strong>).
          </p>
        </div>
      `;
      break;
    }
  }

  return {
    subject,
    html: wrapInSaberEmailFrame(heroTitle, heroSubtitle, bodyHtml, masterLayout)
  };
}
