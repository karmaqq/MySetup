/* ═══════════════════════════════════════════════════════════════════════════ */
/*                       YEREL DOSYA TEMİZLEYİCİ                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

exports.default = async function (context) {
    const fs = require("fs");
    const path = require("path");
    const localeDir = path.join(context.appOutDir, "locales");
    if (!fs.existsSync(localeDir)) return;
    const allowed = ["en-US.pak", "tr.pak"];
    let deleted = 0;
    try {
        const files = fs.readdirSync(localeDir);
        for (const file of files) {
            if (!allowed.includes(file)) {
                try {
                    fs.unlinkSync(path.join(localeDir, file));
                    deleted++;
                } catch (unlinkErr) {
                    console.warn("  ⚠ locale silinemedi:", file, unlinkErr);
                }
            }
        }
    } catch (readErr) {
        console.warn("  ⚠ locale dizini okunamadı:", readErr);
    }
    console.log(`  🧹 ${deleted} locale dosyasi temizlendi (sadece tr/en kaldi)`);
};
