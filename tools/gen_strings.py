#!/usr/bin/env python3
"""Generates android strings.xml for en/fr/ar from one table (keeps the three languages in sync).
Usage: python3 tools/gen_strings.py"""
import os, re, sys
from xml.sax.saxutils import escape

RES = os.path.join(os.path.dirname(__file__), "..", "android", "app", "src", "main", "res")

# key: (en, fr, ar)
S = {
 "app_name": ("Retro Console", "Retro Console", "ريترو كونسول"),
 "back": ("Back", "Retour", "رجوع"),
 "cancel": ("Cancel", "Annuler", "إلغاء"),
 "save": ("Save", "Enregistrer", "حفظ"),
 "install": ("Install", "Installer", "تثبيت"),
 "installing": ("Installing…", "Installation…", "جارٍ التثبيت…"),
 "refresh": ("Refresh", "Actualiser", "تحديث"),
 "key_sound": ("SOUND", "SON", "الصوت"),
 "key_home": ("HOME", "MENU", "الرئيسية"),
 "key_reset": ("RESET", "RESET", "إعادة"),
 "skin_classic": ("Classic", "Classique", "كلاسيك"),
 "skin_purple": ("Purple", "Violet", "بنفسجي"),
 "skin_atomic": ("Atomic", "Atomique", "ذري"),
 "skin_neon": ("Neon", "Néon", "نيون"),
 "skin_racer": ("Racer", "Racer", "سباق"),
 "cat_classic": ("Classic", "Classiques", "كلاسيك"),
 "cat_arcade": ("Arcade", "Arcade", "أركيد"),
 "cat_puzzle": ("Puzzle", "Réflexion", "ألغاز"),
 "cat_action": ("Action", "Action", "حركة"),
 "cat_other": ("Other", "Autre", "أخرى"),
 "store_title": ("Game Store", "Boutique de jeux", "متجر الألعاب"),
 "store_search": ("Search games", "Rechercher un jeu", "ابحث عن لعبة"),
 "store_games_count": ("%1$d games available", "%1$d jeux disponibles", "%1$d لعبة متاحة"),
 "store_install_all": ("Install all (%1$d)", "Tout installer (%1$d)", "تثبيت الكل (%1$d)"),
 "store_all_installed": ("All installed ✓", "Tout est installé ✓", "تم تثبيت الكل ✓"),
 "store_offline": ("Offline - showing saved list", "Hors ligne - liste enregistrée", "بدون اتصال - القائمة المحفوظة"),
 "store_offline_body": ("Can't reach the store. Check your connection and try again.", "Impossible de joindre la boutique. Vérifiez votre connexion.", "تعذر الوصول إلى المتجر. تحقق من اتصالك وحاول مجددًا."),
 "store_empty": ("No games in the store yet.", "Aucun jeu dans la boutique pour le moment.", "لا توجد ألعاب في المتجر بعد."),
 "filter_all": ("All", "Tous", "الكل"),
 "filter_installed": ("Installed", "Installés", "المثبتة"),
 "filter_updates": ("Updates", "Mises à jour", "التحديثات"),
 "btn_install": ("INSTALL", "INSTALLER", "تثبيت"),
 "btn_update": ("UPDATE", "METTRE À JOUR", "تحديث"),
 "btn_play": ("PLAY", "JOUER", "العب"),
 "btn_remove": ("Remove", "Supprimer", "حذف"),
 "label_builtin": ("Built-in", "Intégré", "مدمجة"),
 "label_imported": ("Imported game", "Jeu importé", "لعبة مستوردة"),
 "remove_title": ("Remove %1$s?", "Supprimer %1$s ?", "حذف %1$s؟"),
 "remove_body": ("The game and its hi-scores and saved progress will be deleted from this device.", "Le jeu, ses records et sa sauvegarde seront supprimés de cet appareil.", "ستُحذف اللعبة وأرقامها القياسية وتقدمها المحفوظ من هذا الجهاز."),
 "add_game": ("Add a game", "Ajouter un jeu", "إضافة لعبة"),
 "add_game_hint": ("Install a game package (.zip or a single .html game) from a file, a link or a QR code.", "Installez un jeu (.zip ou un seul fichier .html) depuis un fichier, un lien ou un QR code.", "ثبّت لعبة (ملف .zip أو ملف .html واحد) من ملف أو رابط أو رمز QR."),
 "add_from_file": ("From a file…", "Depuis un fichier…", "من ملف…"),
 "add_from_link": ("From a link…", "Depuis un lien…", "من رابط…"),
 "add_from_rom": ("My own game file (NES / Game Boy)…", "Mon propre fichier de jeu (NES / Game Boy)…", "ملف لعبة خاص بي (NES / Game Boy)…"),
 "rom_title": ("Import your own game?", "Importer votre propre jeu ?", "استيراد لعبتك الخاصة؟"),
 "rom_body": ("%1$s\n\nOnly import game files you own or have the right to use. The file stays on this phone and runs inside the console's sandbox.", "%1$s\n\nN'importez que des fichiers de jeu que vous possédez ou avez le droit d'utiliser. Le fichier reste sur ce téléphone et s'exécute dans le bac à sable de la console.", "%1$s\n\nاستورد فقط ملفات الألعاب التي تملكها أو لديك الحق في استخدامها. يبقى الملف على هذا الهاتف ويعمل داخل بيئة الجهاز المعزولة."),
 "err_rom": ("That isn't a supported game file. The console plays NES (.nes) and Game Boy / Game Boy Color (.gb, .gbc) files.", "Ce fichier n'est pas pris en charge. La console lit les fichiers NES (.nes) et Game Boy / Game Boy Color (.gb, .gbc).", "هذا الملف غير مدعوم. يشغّل الجهاز ملفات NES (‏.nes) وGame Boy / Game Boy Color (‏.gb، ‏.gbc)."),
 "label_rom": ("Your game file", "Votre fichier de jeu", "ملف لعبتك"),
 "add_scan_qr": ("Scan a QR code", "Scanner un QR code", "مسح رمز QR"),
 "add_scan_prompt": ("Point at a game QR code", "Visez un QR code de jeu", "وجّه الكاميرا إلى رمز QR للعبة"),
 "unverified_title": ("Install unverified game?", "Installer un jeu non vérifié ?", "تثبيت لعبة غير موثقة؟"),
 "unverified_body": ("%1$s\n\nThis game does not come from the verified Game Store. Games run in a sandbox without network access, but only install games from sources you trust.", "%1$s\n\nCe jeu ne vient pas de la boutique vérifiée. Les jeux s'exécutent dans un bac à sable sans accès réseau, mais n'installez que des jeux de sources fiables.", "%1$s\n\nهذه اللعبة ليست من المتجر الموثّق. تعمل الألعاب في بيئة معزولة بدون إنترنت، لكن ثبّت ألعابًا من مصادر تثق بها فقط."),
 "msg_installed": ("%1$s installed ✓", "%1$s installé ✓", "تم تثبيت %1$s ✓"),
 "msg_removed": ("%1$s removed", "%1$s supprimé", "تم حذف %1$s"),
 "msg_all_done": ("%1$d games ready", "%1$d jeux prêts", "%1$d لعبة جاهزة"),
 "msg_catalog_error": ("Couldn't load the store list.", "Impossible de charger la liste de la boutique.", "تعذر تحميل قائمة المتجر."),
 "err_too_large": ("That game package is too large.", "Ce jeu est trop volumineux.", "حزمة اللعبة كبيرة جدًا."),
 "err_bad_archive": ("That file isn't a valid game package.", "Ce fichier n'est pas un jeu valide.", "هذا الملف ليس حزمة لعبة صالحة."),
 "err_unsafe": ("The package contains files that aren't allowed.", "Le paquet contient des fichiers non autorisés.", "تحتوي الحزمة على ملفات غير مسموح بها."),
 "err_no_index": ("The package has no index.html.", "Le paquet ne contient pas de index.html.", "لا تحتوي الحزمة على ملف index.html."),
 "err_manifest": ("The game's manifest is invalid.", "Le manifeste du jeu est invalide.", "ملف تعريف اللعبة غير صالح."),
 "err_reserved": ("That game id is reserved by a built-in game.", "Cet identifiant est réservé à un jeu intégré.", "هذا المعرّف محجوز للعبة مدمجة."),
 "err_checksum": ("Download is corrupted (checksum mismatch). Try again.", "Téléchargement corrompu (somme de contrôle). Réessayez.", "التنزيل تالف (عدم تطابق المجموع الاختباري). حاول مجددًا."),
 "err_sdk": ("This game needs a newer version of Retro Console.", "Ce jeu nécessite une version plus récente de Retro Console.", "تتطلب هذه اللعبة إصدارًا أحدث من التطبيق."),
 "err_network": ("Network error. Check your connection and try again.", "Erreur réseau. Vérifiez votre connexion et réessayez.", "خطأ في الشبكة. تحقق من اتصالك وحاول مجددًا."),
 "err_io": ("Couldn't read or write the game files.", "Impossible de lire ou d'écrire les fichiers du jeu.", "تعذر قراءة ملفات اللعبة أو كتابتها."),
 "settings_title": ("Settings", "Réglages", "الإعدادات"),
 "sec_console": ("Console", "Console", "الجهاز"),
 "sec_sound": ("Sound & touch", "Son et toucher", "الصوت واللمس"),
 "sec_controls": ("Controls", "Commandes", "التحكم"),
 "sec_language": ("Language", "Langue", "اللغة"),
 "sec_store": ("Game Store", "Boutique de jeux", "متجر الألعاب"),
 "sec_data": ("Data", "Données", "البيانات"),
 "sec_about": ("About", "À propos", "حول"),
 "set_skin": ("Console skin", "Coque de la console", "شكل الجهاز"),
 "set_lcd": ("Screen look", "Aspect de l'écran", "مظهر الشاشة"),
 "lcd_color": ("Full color", "Couleur", "ملوّن"),
 "lcd_gb": ("Green LCD", "LCD vert", "شاشة خضراء"),
 "lcd_brick": ("Brick mono", "Mono brique", "أحادي كلاسيك"),
 "set_grid": ("Pixel grid", "Grille de pixels", "شبكة البكسل"),
 "set_grid_hint": ("Dot-matrix look like the old handhelds", "Effet matrice de points des anciennes consoles", "مظهر المصفوفة النقطية للأجهزة القديمة"),
 "set_boot": ("Boot animation", "Animation de démarrage", "حركة بدء التشغيل"),
 "set_sound": ("Sound", "Son", "الصوت"),
 "set_volume": ("Volume", "Volume", "مستوى الصوت"),
 "set_vibrate": ("Vibration", "Vibration", "الاهتزاز"),
 "set_vibrate_hint": ("Button taps and game effects", "Appuis sur les touches et effets de jeu", "عند الضغط على الأزرار وتأثيرات الألعاب"),
 "set_lefty": ("Left-handed layout", "Disposition gaucher", "تخطيط لليد اليسرى"),
 "set_btn_size": ("Button size", "Taille des touches", "حجم الأزرار"),
 "set_gamepad_hint": ("Bluetooth gamepads and keyboards work too: arrows/D-pad, Space/A = A, X/B = B, Enter/Start = S/P, Select/Esc = Home.", "Les manettes Bluetooth et claviers fonctionnent aussi : flèches/croix, Espace/A = A, X/B = B, Entrée/Start = S/P, Select/Échap = Menu.", "تعمل أذرع التحكم ولوحات المفاتيح أيضًا: الأسهم، المسافة/A = A، X/B = B، Enter/Start = S/P، Select/Esc = الرئيسية."),
 "lang_system": ("System", "Système", "النظام"),
 "lang_en": ("English", "English", "English"),
 "lang_fr": ("Français", "Français", "Français"),
 "lang_ar": ("العربية", "العربية", "العربية"),
 "set_autoupdate": ("Auto-update games", "Mise à jour automatique", "تحديث الألعاب تلقائيًا"),
 "set_autoupdate_hint": ("In the background, on Wi-Fi only", "En arrière-plan, uniquement en Wi-Fi", "في الخلفية وعبر Wi-Fi فقط"),
 "set_store_url": ("Store catalog URL", "URL du catalogue", "رابط كتالوج المتجر"),
 "set_store_default": ("Reset to default", "Valeur par défaut", "الافتراضي"),
 "set_reset_progress": ("Reset hi-scores & saves", "Réinitialiser records et sauvegardes", "إعادة ضبط الأرقام والحفظ"),
 "set_reset_body": ("This deletes every hi-score, trophy and saved game on this device.", "Ceci supprime tous les records, trophées et sauvegardes de cet appareil.", "سيحذف هذا كل الأرقام القياسية والكؤوس والألعاب المحفوظة على هذا الجهاز."),
 "about_body": ("A colourful 9999-in-1 handheld. Games are tiny HTML5 packages: add yours from the Game Store, a file, a link or a QR code.", "Une console portable 9999-en-1 en couleurs. Les jeux sont de petits paquets HTML5 : ajoutez les vôtres depuis la boutique, un fichier, un lien ou un QR code.", "جهاز محمول ملوّن 9999 في 1. الألعاب حزم HTML5 صغيرة: أضف ألعابك من المتجر أو ملف أو رابط أو رمز QR."),
 "about_font": ("Pixel font: Press Start 2P (SIL OFL 1.1). Emulators for your own game files: jsnes (Apache-2.0) and binjgb (MIT).", "Police pixel : Press Start 2P (SIL OFL 1.1). Émulateurs pour vos propres fichiers : jsnes (Apache-2.0) et binjgb (MIT).", "خط البكسل: Press Start 2P (رخصة SIL OFL 1.1). محاكيات لملفات ألعابك: jsnes (Apache-2.0) وbinjgb (MIT)."),
 "trophies_title": ("Trophies & records", "Trophées et records", "الكؤوس والأرقام القياسية"),
 "stat_trophies": ("Trophies", "Trophées", "الكؤوس"),
 "stat_played": ("Games played", "Jeux joués", "ألعاب لُعبت"),
 "stat_time": ("Play time", "Temps de jeu", "وقت اللعب"),
 "trophy_line": ("HI %1$d  •  %2$d plays  •  %3$s", "REC %1$d  •  %2$d parties  •  %3$s", "الأعلى %1$d  •  %2$d مرات  •  %3$s"),
}

def xml(idx):
    out = ['<?xml version="1.0" encoding="utf-8"?>', '<resources>']
    for k, v in S.items():
        text = v[idx]
        t = escape(text).replace("'", "\\'").replace("\n", "\\n")
        if idx == 0 and k == "app_name": pass
        out.append(f'    <string name="{k}">{t}</string>')
    out.append('</resources>')
    return "\n".join(out) + "\n"

for idx, folder in enumerate(["values", "values-fr", "values-ar"]):
    os.makedirs(os.path.join(RES, folder), exist_ok=True)
    open(os.path.join(RES, folder, "strings.xml"), "w", encoding="utf-8").write(xml(idx))

# verify that every R.string.* used by the code exists, and that format args match across languages
src = os.path.join(RES, "..", "java")
used = set()
for root, _, files in os.walk(src):
    for f in files:
        if f.endswith(".kt"):
            used |= set(re.findall(r"R\.string\.([a-z_0-9]+)", open(os.path.join(root, f), encoding="utf-8").read()))
missing = sorted(used - set(S))
unused = sorted(set(S) - used - {"app_name"})
for k, v in S.items():
    args = [sorted(re.findall(r"%\d\$[ds]", x)) for x in v]
    if not (args[0] == args[1] == args[2]): print("FORMAT MISMATCH", k, args)
print("strings:", len(S), "| missing:", missing, "| unused:", unused)
sys.exit(1 if missing else 0)
