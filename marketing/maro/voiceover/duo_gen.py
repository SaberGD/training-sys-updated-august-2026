# Dialogue voice-over for the MARO launch: G = student (girl), B = MARO (boy).
# Each entry: (slot_start, slot_end, [(voice, text), ...]) on the 60s timeline.
import sys
from concurrent.futures import ThreadPoolExecutor
import el
G, B = 'cgSgspJ2msm6clMCkdW9', 'pNInz6obpgDQGcFmaJgB'
SCRIPT = [
 (0.3, 3.9, [(G, 'تلاتة الفَجْر.. ومَفيش وَلا فِكْرَة!')]),
 (4.3, 6.3, [(B, '[excited] لَحْظَة.. مَتْعَيَّطيش!')]),
 (6.5, 9.3, [(B, '[excited] أنا مارو.. مَعاكي عَلى طول!')]),
 (9.5, 14.3, [(G, 'عايْزَة فِكْرَة..'), (B, '[sarcastic] بَس كِدَه؟ خُدي تَلاتَة!')]),
 (14.5, 18.3, [(B, 'وبْريف كامِل في تَواني.. مِن غير ما تِفْتَحي وَلا مَلَف وورد.')]),
 (18.5, 21.1, [(B, 'صورَة عاجْباكي؟ خُدي البرومبت بِتاعْها.')]),
 (21.3, 23.3, [(B, 'وبرومبت مُحْتَرِف.. مِن كَلامِك.')]),
 (23.5, 26.7, [(B, 'وصورْتين بَدَل واحْدَة.. عَشان تِسْتاهْلي!')]),
 (26.9, 32.7, [(G, 'طَب قَيِّمْلي تَصْميمي.'), (B, '[sarcastic] بِصَراحَة وبأدَب؟ العُنْوان تايِه، والألْوان عامْلَة خِناءَة. [pause] عَدِّلْنا.. سِتَّة بَءِت تِسْعَة!')]),
 (32.9, 36.9, [(B, 'شُفْتي تَصْميم عَجَبِك؟ مِش هَنِسْرَءُه.. هَنِفْهَمُه.')]),
 (37.1, 42.9, [(G, '[curious] إنْتَ مِش بِتْنام؟'), (B, '[sarcastic] تَلاتَة الفَجْر؟ صاحي. حْداشَر بالليل؟ صاحي بَرْضُه. [laughs] ودي مِش شَكْوى.')]),
 (43.1, 47.9, [(B, 'وفي مَشْروع التَّخَرُّج.. أنا المُدَرِّب بِتاعِك!')]),
 (48.1, 53.5, [(G, '[excited] صابر جروب.. المَكان الوَحيد اللي مَعاك فيه مُساعِد زَكي.. أرْبَعَة وعِشْرين ساعَة!')]),
 (53.7, 57.9, [(B, '[excited] جَرَّب مارو دِلْوَءْتي.. وخُد خَصْم أرْبَعْمِيَّة جِنيه!')]),
 (57.95, 59.95, [(B, '[warmly] مارو.. مَعاك عَلى طول.')]),
]
if __name__ == '__main__':
    jobs = [(v, t, f'duo/{i:02d}_{j}.mp3') for i, (a, b, parts) in enumerate(SCRIPT, 1) for j, (v, t) in enumerate(parts)]
    only = set(sys.argv[1:])
    if only: jobs = [j for j in jobs if j[2] in only]
    print(len(jobs), 'clips', sum(len(t) for _, t, _ in jobs), 'chars')
    with ThreadPoolExecutor(2) as ex: print(list(ex.map(lambda j: el.tts(j[0], j[1], j[2], stab=0.5), jobs)))
