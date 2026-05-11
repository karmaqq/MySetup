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
    for (const file of fs.readdirSync(localeDir)) {
        if (!allowed.includes(file)) {
            fs.unlinkSync(path.join(localeDir, file));
            deleted++;
        }
    }
    console.log(`  🧹 ${deleted} locale dosyasi temizlendi (sadece tr/en kaldi)`);
};
