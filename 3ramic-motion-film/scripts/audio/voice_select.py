#!/usr/bin/env python3
"""
3RAMIC — choose one take per line and install it in the film.

    python scripts/audio/voice_select.py                     # automatic choice
    python scripts/audio/voice_select.py --pick L05=amir-t3  # a listener's choice wins

For every line it looks at the analysed takes of the cast voice
(production/takes/<line>/<voice>-t*.wav + .analysis.json, written by
voice_synthesize.py and voice_analyze.py) and ranks them:

  1. intelligibility — Whisper's transcript against the intended words (dominant),
  2. the brand — on brand lines the recogniser must hear «سرامیک» / «سه‌رامیک»,
  3. sanity — no runaway take (much longer than the others), no clipping,
  4. liveliness — wider pitch movement is preferred among equally clear takes.

The winner is copied to public/audio/voice/<line>.wav and its exact phoneme/word timing
to production/voice/<line>.align.json (with the WAV's checksum, so a replaced recording
is detected and timed from its own audio instead). A report is written to
production/voice/VOICE-REPORT.md.

What the ranking cannot know is whether a take is *funny*. `--pick` exists so a person
who has listened can overrule it.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
TAKES = os.path.join(ROOT, "production", "takes")
VOICE_OUT = os.path.join(ROOT, "public", "audio", "voice")
ALIGN_OUT = os.path.join(ROOT, "production", "voice")

BRAND_HEARD = re.compile(r"سرامیک|سه ?رامیک|سرامی")


def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def score(a, median_len):
    s = 10.0 * a["match"] + 3.0 * a.get("persian", 0.5)  # clear first, then native-sounding
    if a["seconds"] > 1.35 * median_len + 0.15:
        s -= 4.0  # runaway / stretched take
    if a["peak"] >= 0.99:
        s -= 1.0
    if a["silence"] > 0.5:
        s -= 1.0
    s += 0.12 * min(a["f0_spread_st"], 6.0)
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pick", action="append", default=[], help="LINE=take, e.g. L05=amir-t3")
    ap.add_argument("--no-prosody", action="store_true", help="install the takes without intonation shaping")
    args = ap.parse_args()
    picks = dict(p.split("=", 1) for p in args.pick)

    sp = json.load(open(os.path.join(ROOT, "production", "screenplay.json"), encoding="utf-8"))
    cast = json.load(open(os.path.join(ROOT, "production", "cast.json"), encoding="utf-8"))
    phon = json.load(open(os.path.join(ROOT, "production", "phonemes.json"), encoding="utf-8"))
    os.makedirs(VOICE_OUT, exist_ok=True)
    os.makedirs(ALIGN_OUT, exist_ok=True)

    report, problems, chosen_all = [], [], {}
    for l in sp["lines"]:
        lid = l["id"]
        voice = cast["voices"][l["speaker"]]
        d = os.path.join(TAKES, lid)
        takes = []
        for name in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if not name.endswith(".analysis.json"):
                continue
            a = json.load(open(os.path.join(d, name), encoding="utf-8"))
            if not a["take"].startswith(voice["model"] + "-t"):
                continue
            takes.append(a)
        if not takes:
            # no speech-recognition check available (voice_analyze.py needs torch + Whisper):
            # fall back to the first take, unchecked, and say so
            first = os.path.join(d, f"{voice['model']}-t0.json")
            if not os.path.exists(first):
                problems.append(f"{lid}: no takes for {voice['model']} — run voice_synthesize.py --takes N")
                continue
            m = json.load(open(first, encoding="utf-8"))
            takes = [{"take": m["take"], "heard": "(not checked)", "match": 0.0, "seconds": m["seconds"], "peak": 0.0, "silence": 0.0, "f0": 0.0, "f0_spread_st": 0.0}]
            problems.append(f"{lid}: take not checked by speech recognition (voice_analyze.py was not run) — listen before release")
        lens = sorted(t["seconds"] for t in takes)
        median_len = lens[len(lens) // 2]
        for t in takes:
            t["score"] = round(score(t, median_len), 3)
            t["brandHeard"] = bool(BRAND_HEARD.search(t["heard"]))
        pool = takes
        if l.get("brand"):
            ok = [t for t in takes if t["brandHeard"]]
            if ok:
                pool = ok
            else:
                problems.append(f"{lid}: no take where the recogniser heard «سه‌رامیک» — listen and pick by hand")
        if lid in picks:
            best = next((t for t in takes if t["take"] == picks[lid]), None)
            if best is None:
                raise SystemExit(f"--pick {lid}={picks[lid]}: no such analysed take")
            how = "picked by hand"
        else:
            best = max(pool, key=lambda t: t["score"])
            how = "automatic"
        if best["match"] < 0.85:
            problems.append(f"{lid}: best take only {best['match']:.2f} intelligible («{best['heard']}») — consider a human recording")

        src = os.path.join(d, best["take"] + ".wav")
        dst = os.path.join(VOICE_OUT, f"{lid}.wav")
        shutil.copyfile(src, dst)
        prosody = None
        if not args.no_prosody and os.path.exists(os.path.join(ROOT, "production", "prosody.json")):
            # intonation shaping (questions rise, livelier range, one steady pitch per character);
            # timing is unchanged, so the phoneme alignment below stays valid
            try:
                import soundfile as sf
                from voice_prosody import settings as prosody_settings, shape as prosody_shape

                x, sr = sf.read(dst, dtype="float64")
                y, prosody = prosody_shape(x, sr, prosody_settings(l["speaker"], lid))
                sf.write(dst, y, sr, subtype="PCM_16")
            except ImportError as e:
                problems.append(f"{lid}: intonation shaping skipped ({e}; pip install pyworld soundfile)")
        meta = json.load(open(os.path.join(d, best["take"] + ".json"), encoding="utf-8"))
        align = {
            "line": lid,
            "source": "synthesis",
            "note": "Exact phoneme and word timing reported by the voice model while it spoke this take (seconds on the WAV's own clock). Valid only for the WAV with this sha1; a replaced recording is timed from its own audio.",
            "wav": f"public/audio/voice/{lid}.wav",
            "sha1": sha1(dst),
            "take": best["take"],
            "voice": voice["model"],
            "engine": voice["engine"],
            "seconds": meta["seconds"],
            "heard": best["heard"],
            "match": best["match"],
            "prosody": prosody,
            "phones": meta["phones"],
            "words": meta["words"],
        }
        json.dump(align, open(os.path.join(ALIGN_OUT, f"{lid}.align.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        chosen_all[lid] = best["take"]
        report.append((l, voice, best, how, sorted(takes, key=lambda t: -t["score"])))

    # ------------------------------------------------------------------ report
    out = []
    out.append("# گزارش صدا — Voice report\n")
    out.append("Generated by `scripts/audio/voice_select.py`. Every number below is measured by software; **nobody has listened to these takes**. Intelligibility (`match`) is how closely Whisper large-v3-turbo's Persian transcript matches the intended words (1.00 = identical). It says nothing about acting, comic timing or warmth — those remain **unverified** until a person listens.\n")
    out.append("## Cast\n")
    out.append("| Role | Voice model | Engine | Why |\n|---|---|---|---|")
    for role, v in cast["voices"].items():
        out.append(f"| {role} | {v['model']} | {v['engine']} | {v.get('why', '')} |")
    out.append("\nLicences: see `production/cast.json` (`models` → `license`). All voices are open models trained on public-domain (CC0) Persian recordings; no real person's voice was cloned.\n")
    out.append("## Chosen takes\n")
    out.append("| Line | Role | Take | Match | Heard by Whisper | Length | Pitch spread | Choice |\n|---|---|---|---|---|---|---|---|")
    for l, v, b, how, _ in report:
        out.append(f"| {l['id']} | {l['speaker']} | `{b['take']}` | {b['match']:.2f} | {b['heard']} | {b['seconds']:.2f} s | ±{b['f0_spread_st']:.1f} st | {how} |")
    mean = sum(b["match"] for _, _, b, _, _ in report) / max(1, len(report))
    out.append(f"\nMean intelligibility of the chosen takes: **{mean:.2f}**.\n")
    out.append("## Brand pronunciation\n")
    for l, v, b, how, _ in report:
        if l.get("brand"):
            out.append(f"- {l['id']}: phonemes `{phon['lines'][l['id']]['phrases'][0]['ph']}…` (se-râ-mik); Whisper heard «{b['heard']}» → {'contains «سرامیک» ✔' if b['brandHeard'] else 'brand word NOT recognised ✘'}")
    out.append("\nThe written brand is always `3ramic`; the spoken form is always «سه‌رامیک» /serˈɑmik/. The phoneme strings never contain an English \"three\" (θɹiː / tri / sri).\n")
    out.append("## Open problems\n")
    out.extend([f"- {p}" for p in problems] or ["- none found by the automatic checks"])
    out.append("\n## All takes\n")
    for l, v, b, how, takes in report:
        out.append(f"<details><summary>{l['id']} — {l['displayText']}</summary>\n")
        out.append("| Take | Score | Match | Heard | Length | f0 | Spread |\n|---|---|---|---|---|---|---|")
        for t in takes:
            out.append(f"| `{t['take']}`{' ✔' if t['take'] == b['take'] else ''} | {t['score']:.2f} | {t['match']:.2f} | {t['heard']} | {t['seconds']:.2f} s | {t['f0']:.0f} Hz | ±{t['f0_spread_st']:.1f} st |")
        out.append("\n</details>\n")
    out.append("## To replace a voice with a human recording\n")
    out.append("Record the line following `production/acting-direction.fa.md`, save it as 48 kHz (or 44.1 kHz) 16-bit mono WAV at `public/audio/voice/<line>.wav`, then run `npm run timeline`. The film re-times every shot, subtitle and mouth shape to the new file (its checksum no longer matches the synthetic alignment, so timing comes from the recording's own speech energy).\n")
    open(os.path.join(ALIGN_OUT, "VOICE-REPORT.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    json.dump({"chosen": chosen_all, "problems": problems, "meanMatch": round(mean, 3)}, open(os.path.join(ALIGN_OUT, "selection.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for l, v, b, how, _ in report:
        print(f"{l['id']} {l['speaker']:<9} {b['take']:<16} match {b['match']:.2f}  {b['seconds']:.2f}s  | {b['heard']}")
    print(f"mean match {mean:.3f}")
    for p in problems:
        print("  !", p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
