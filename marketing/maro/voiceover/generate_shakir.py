# Generates the 15 MARO voice-over lines with Microsoft's Egyptian voice "Shakir".
# On your computer (needs Python 3):   pip install edge-tts   then   python generate_shakir.py
# Output: a "shakir" folder with 01.mp3 ... 15.mp3. Send the whole folder back to be mixed onto the video.
import asyncio, os, edge_tts
VOICE = 'ar-EG-ShakirNeural'
# (text, rate, pitch): a slightly faster rate and higher pitch give more energy
LINES = [
 ('تلاتة الفجر، والتسليم الصبح.. والشاشة بتبصلك وإنت بتبصلها؟', '+5%', '+0Hz'),
 ('لحظة.. متعيطش!', '+10%', '+4Hz'),
 ('أنا مارو! مساعدك الذكي من صابر جروب.. معاك على طول.', '+8%', '+3Hz'),
 ('مش لاقي فكرة لكامبين فيزيتا؟ عادي.. أنا عندي تلاتة. اختار إنت.. ولا أختارلك أنا كمان؟', '+12%', '+2Hz'),
 ('بريف كامل في ثواني: البراند، الجمهور، الرسالة.. من غير ما تفتح ولا ملف وورد.', '+12%', '+2Hz'),
 ('صورة عجبتك؟ هاتها.. أطلعلك البرومبت بتاعها.', '+10%', '+2Hz'),
 ('فكرة بالعامي؟ أحولهالك برومبت محترف.', '+10%', '+2Hz'),
 ('وأولّدلك الصورة كمان.. لأ، مش صورة.. اتنين. عشان إنت تستاهل.', '+10%', '+3Hz'),
 ('وريني تصميمك.. هقولك الحقيقة بس بأدب: العنوان تايه، والألوان عاملة خناقة. عدّلنا؟ ستة بقت تسعة.', '+12%', '+2Hz'),
 ('شفت تصميم عجبك؟ مش هنسرقه.. هنفهمه: التكوين، الترتيب، والفكرة.', '+10%', '+2Hz'),
 ('تلاتة الفجر؟ صاحي. حداشر بالليل وفاتتك محاضرة؟ صاحي برضه. أنا مبنامش.. ودي مش شكوى.', '+12%', '+2Hz'),
 ('وفي مشروع التخرج؟ أنا المدرب.. بقيّم، وأنصح، وأقولك الحتة اللي هتفرق.', '+10%', '+2Hz'),
 ('صابر جروب.. المكان الوحيد اللي بيديلك مساعد ذكي شخصي، معاك أربعة وعشرين ساعة.. طول الكورس وبعده.', '+10%', '+4Hz'),
 ('جرّب مارو دلوقتي، وخد خصم أربعمية جنيه.. لمدة تمانية وأربعين ساعة بس. متستناش لتلاتة الفجر!', '+12%', '+4Hz'),
 ('مارو.. معاك على طول.', '+0%', '+0Hz'),
]
async def main():
    os.makedirs('shakir', exist_ok=True)
    for i, (text, rate, pitch) in enumerate(LINES, 1):
        out = f'shakir/{i:02d}.mp3'
        await edge_tts.Communicate(text, VOICE, rate=rate, pitch=pitch).save(out)
        print('ok', out)
asyncio.run(main())
