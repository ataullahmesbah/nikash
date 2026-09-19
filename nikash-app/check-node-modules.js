// node_modules-এ নষ্ট (বাইনারি আবর্জনাযুক্ত) .js ফাইল খোঁজে।
// সুস্থ JavaScript ফাইলে কখনো NUL বাইট (0x00) থাকে না।
const fs = require("fs"), path = require("path");
let checked = 0, bad = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".js") || e.name.endsWith(".json")) {
      checked++;
      try {
        const buf = fs.readFileSync(p);
        if (buf.includes(0)) bad.push(p);
      } catch { /* পড়া যায়নি */ }
    }
  }
}

walk("node_modules");
console.log(`পরীক্ষা করা ফাইল: ${checked}`);
if (bad.length === 0) console.log("✅ কোনো নষ্ট ফাইল নেই");
else {
  console.log(`❌ নষ্ট ফাইল: ${bad.length}টি\n`);
  bad.slice(0, 25).forEach(f => console.log("   " + f));
  if (bad.length > 25) console.log(`   ... আরও ${bad.length - 25}টি`);
}
