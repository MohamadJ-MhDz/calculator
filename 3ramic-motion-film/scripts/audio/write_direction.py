#!/usr/bin/env python3
"""
3RAMIC — writes production/acting-direction.fa.md from the screenplay, the phonemes and
the current timeline, so the recording script can never drift from the film.

    python scripts/audio/write_direction.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))


def main():
    sp = json.load(open(os.path.join(ROOT, "production", "screenplay.json"), encoding="utf-8"))
    phon = json.load(open(os.path.join(ROOT, "production", "phonemes.json"), encoding="utf-8"))
    cast = json.load(open(os.path.join(ROOT, "production", "cast.json"), encoding="utf-8"))
    tl_path = os.path.join(ROOT, "src", "data", "timeline.json")
    tl = json.load(open(tl_path, encoding="utf-8")) if os.path.exists(tl_path) else {"lines": []}
    secs = {l["id"]: l["seconds"] for l in tl["lines"]}
    fa_digits = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

    o = []
    o.append(f"# راهنمای بازیگری و ضبط — «{sp['title']['fa']}»\n")
    o.append("این فایل خودکار از `production/screenplay.json` ساخته می‌شود (`python scripts/audio/write_direction.py`). برای تغییر دیالوگ، آن فایل را ویرایش کنید، نه این‌جا را.\n")
    o.append("## قانونِ طلاییِ تلفظ\n")
    o.append("- نامِ برند همیشه **«سه‌رامیک»** خوانده می‌شود: سه + رامیک، /serˈɑmik/، تکیه روی «را».")
    o.append("- هرگز «تری‌رامیک»، «ثری‌رامیک» یا «Three-ramic» نگویید. عدد ۳ در اسم فقط نوشتاری است.")
    o.append("- نوشتارِ برند روی تصویر و در زیرنویس همیشه `3ramic` است؛ گفتارش همیشه «سه‌رامیک».\n")
    o.append("## شخصیت‌ها\n")
    o.append("| شخصیت | کیست | لحن و صدا | صدای فعلی (مصنوعی) |\n|---|---|---|---|")
    for k, c in sp["cast"].items():
        v = cast["voices"].get(k, {})
        o.append(f"| **{c['nameFa']}** | {c.get('personalityFa', c['role'])} | {c.get('voiceFa', '')} | `{v.get('model', '—')}` |")
    o.append("\nهیچ‌کدام از صداها تقلیدِ صدای یک شخصِ واقعی نیست و نباید باشد. اگر با بازیگر ضبط می‌کنید، رضایت‌نامهٔ کتبیِ استفادهٔ تجاری بگیرید.\n")
    o.append("## مشخصاتِ فنیِ ضبط\n")
    o.append("- فایل: WAV، مونو، ۱۶ بیت، ۴۸ کیلوهرتز (۴۴٫۱ هم قبول است). نام فایل دقیقاً شناسهٔ خط است: `L01.wav` … `L16.wav`.")
    o.append("- جا: اتاقِ کم‌پژواک (کمد لباس یا اتاقِ پر از پارچه). میکروفون ۱۵ تا ۲۰ سانتی‌متر از دهان، با پاپ‌فیلتر.")
    o.append("- سکوتِ اولِ هر فایل کمتر از ۰٫۱ ثانیه؛ هیچ افکت یا ریوربی روی صدا نگذارید (فضای حمام در میکس اضافه می‌شود).")
    o.append("- سطح: پیک حدود ‎−6 dBFS؛ هرگز کلیپ نشود.")
    o.append("- برای هر خط سه برداشت با حس‌های کمی متفاوت بگیرید؛ بهترین را با همان نام بگذارید.")
    o.append("- فایل‌ها را در `public/audio/voice/` بگذارید و `npm run timeline` را اجرا کنید: طولِ نماها، زیرنویس و حرکتِ دهان خودکار با ضبطِ جدید هماهنگ می‌شود.\n")
    o.append("## خط به خط\n")
    names = {k: c["nameFa"] for k, c in sp["cast"].items()}
    for l in sp["lines"]:
        p = phon["lines"][l["id"]]
        pace = p.get("rate", 1.0)
        pace_fa = "تند" if pace > 1.03 else "آرام" if pace < 0.93 else "عادی"
        o.append(f"### {l['id']} — {names[l['speaker']]}\n")
        o.append(f"- **روی تصویر:** «{l['displayText']}»")
        if l["speechText"] != l["displayText"]:
            o.append(f"- **گفتار:** «{l['speechText']}»")
        o.append(f"- **حس:** {l['emotion']} — شدت {str(l['intensity']).translate(fa_digits)} از ۱۰")
        if l.get("emphasis"):
            o.append(f"- **تأکید روی:** {'، '.join('«' + e + '»' for e in l['emphasis'])}")
        o.append(f"- **راهنما:** {l['direction']}")
        o.append(f"- **روی صحنه:** {l['action']}")
        pauses = [ph for ph in p["phrases"] if ph.get("pause")]
        tail = f"؛ {len(pauses)} مکثِ کوتاه وسطِ جمله".translate(fa_digits) if pauses else ""
        length = f" — طولِ فعلی ≈ {secs[l['id']]:.1f} ثانیه".translate(fa_digits) if l["id"] in secs else ""
        o.append(f"- **سرعت:** {pace_fa}{tail}{length}")
        o.append(f"- **آوانگاری:** `{' | '.join(ph['ph'] for ph in p['phrases'])}`\n")
    path = os.path.join(ROOT, "production", "acting-direction.fa.md")
    open(path, "w", encoding="utf-8").write("\n".join(o) + "\n")
    print("wrote", os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
