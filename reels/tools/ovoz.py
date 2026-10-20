#!/usr/bin/env python3
"""Diktor ovozini yaratib, videoga sahnalar vaqtiga moslab qo'shadi.

Ovoz: Microsoft Neural — uz-UZ-SardorNeural (erkak) yoki uz-UZ-MadinaNeural (ayol),
o'zbek tilida tug'ma ovozlar. Internet kerak, kalit yoki hisob kerak emas.

    pip install edge-tts          # ffmpeg ham o'rnatilgan bo'lishi kerak
    python tools/ovoz.py                         # erkak ovoz
    python tools/ovoz.py --ovoz madina           # ayol ovoz
    python tools/ovoz.py --tezlik 5              # hammasini 5% tezroq o'qish

Natija: reels-ovozli.mp4 (va ovoz/ papkasida har sahnaning alohida mp3 fayli).
"""
import argparse, asyncio, json, os, subprocess, sys

# (boshlanish soniyasi, sahnaga ajratilgan vaqt, matn)
SAHNALAR = [
    (0.2, 3.7, "Bitta hovli — o‘n ikki xil ko‘rinish. Siz qaysi birini tanlaysiz?"),
    (4.15, 4.7, "Klassik, ya’ni regular uslub: simmetriya, to‘g‘ri yo‘laklar va aniq geometrik shakllar."),
    (9.15, 4.7, "Ingliz peyzaj bog‘ida yo‘laklar egilib boradi, maysazor keng, daraxtlar esa tabiiy guruh bo‘lib o‘sadi."),
    (14.15, 4.7, "Fransuz bog‘i — regularning tantanavor tarixiy ko‘rinishi: naqshli parterlar, kesilgan butalar va markaziy o‘q."),
    (19.15, 4.7, "Italyan bog‘i qiyalikni terrasalarga bo‘ladi: zinapoyalar, tosh devorlar va favvoralar."),
    (24.15, 4.7, "Chorbog‘ — islomiy bog‘ shakllaridan biri: to‘rt qism, suv yo‘llari, salqin soya va ichki hovli."),
    (29.15, 4.7, "Yapon bog‘ida tosh, suv va bo‘sh joy bir-birini to‘ldiradi. Asosiysi — muvozanat."),
    (34.15, 4.7, "Xitoy bog‘ida hovuz, qoyatosh va pavilon bor, manzaralar esa ketma-ket ochilib boradi."),
    (39.15, 4.7, "O‘rta yer dengizi uslubi: terrakota tuvaklar, tosh yo‘laklar va lavanda kabi xushbo‘y o‘simliklar."),
    (44.15, 4.7, "Rustik, qishloq uslubi: yog‘och va tosh, rang-barang gullar hamda mevali daraxtlar."),
    (49.15, 4.7, "Zamonaviy minimalizm: sodda geometriya, kam turdagi o‘simlik va keng ochiq maydon."),
    (54.15, 4.7, "Naturalistik bog‘da boshoqli o‘tlar va ko‘p yillik gullar tabiatdagidek qatlam-qatlam o‘sadi."),
    (59.15, 4.75, "Tropik ko‘rinish: yirik barglar, zich yashillik, qatlamli ekish. Bizda uni qishga chidamli o‘simliklar bilan quramiz."),
    (64.3, 7.5, "Mana, bitta hovlining o‘n ikki xil ko‘rinishi. Qaysi uslub sizniki? Raqamini kommentga yozing! Aziz Floran bilan hovlingizni birga loyihalaymiz."),
]
OVOZLAR = {"sardor": "uz-UZ-SardorNeural", "madina": "uz-UZ-MadinaNeural"}


def davomiylik(fayl):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", fayl],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])


async def yarat(matn, ovoz, tezlik, fayl):
    import edge_tts
    await edge_tts.Communicate(matn, ovoz, rate=f"{tezlik:+d}%").save(fayl)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ovoz", default="sardor", choices=OVOZLAR)
    ap.add_argument("--tezlik", type=int, default=0, help="foizda, masalan 5 yoki -5")
    ap.add_argument("--video", default="aziz-floran-12-uslub.mp4")
    ap.add_argument("--chiqish", default="reels-ovozli.mp4")
    a = ap.parse_args()
    os.makedirs("ovoz", exist_ok=True)
    fayllar = []
    for i, (boshi, joy, matn) in enumerate(SAHNALAR):
        fayl = f"ovoz/{i:02d}.mp3"
        tezlik = a.tezlik
        await yarat(matn, OVOZLAR[a.ovoz], tezlik, fayl)
        d = davomiylik(fayl)
        # sahnaga sig'masa, kerakli darajada tezlashtirib qayta yaratamiz (ko'pi bilan +30%)
        if d > joy:
            tezlik = min(30, a.tezlik + int((d / joy - 1) * 100) + 3)
            await yarat(matn, OVOZLAR[a.ovoz], tezlik, fayl)
            d = davomiylik(fayl)
        print(f"{i:02d}  {boshi:5.2f}s  {d:4.2f}/{joy:.2f}s  tezlik {tezlik:+d}%" + ("  ⚠ sig'madi" if d > joy + .2 else ""))
        fayllar.append((boshi, fayl))
    kirish = ["-i", a.video]
    for _, f in fayllar:
        kirish += ["-i", f]
    filtr = "".join(f"[{k + 1}:a]adelay={int(b * 1000)}:all=1[a{k}];" for k, (b, _) in enumerate(fayllar))
    filtr += "".join(f"[a{k}]" for k in range(len(fayllar))) + f"amix=inputs={len(fayllar)}:normalize=0,apad[out]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *kirish, "-filter_complex", filtr, "-map", "0:v", "-map", "[out]",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", a.chiqish], check=True)
    print("Tayyor:", a.chiqish)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except ModuleNotFoundError:
        sys.exit("Avval o'rnating: pip install edge-tts")
