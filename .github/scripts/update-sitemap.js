#!/usr/bin/env node
"use strict";

/**
 * Automaticky generováno appkou SEOVIP (npm run configure).
 *
 * Spouští se přes GitHub Actions (.github/workflows/update-sitemap.yml) na
 * pravidelném rozvrhu. Stáhne z backendu aktuální dynamickou sitemapu
 * veřejných reportů (https://seovip.web.app/sitemap-reports.xml) a zamíchá ji do
 * sitemap.xml, kterou má appka na frontendu (tuhle sitemapu čte Google
 * u téhle domény) — takže se nové/aktualizované reporty propíšou i sem,
 * bez ohledu na to, jestli má někdo verifikovanou i tu backendovou
 * *.web.app doménu v Search Console.
 *
 * Nejde o duplicitní obsah — sitemapa jen ODKAZUJE na reporty, které
 * pořád fyzicky žijí (a jsou indexovatelné) jen na backendu. Stejný
 * princip jako když si web nechá sitemapu obrázků nebo videí na jiné
 * doméně/CDN.
 *
 * Když se stažení backendové sitemapy nepovede (výpadek, přejmenovaný
 * projekt apod.), skript skončí potichu (exit 0) a sitemap.xml nechá
 * beze změny — ať jeden neúspěšný běh nerozbije nic, co už funguje.
 */

var fs = require("fs");
var path = require("path");

var BACKEND_SITEMAP_URL = "https://seovip.web.app/sitemap-reports.xml";
var SITEMAP_PATH = path.join(__dirname, "..", "..", "sitemap.xml");

function extractUrlBlocks(xml) {
  return xml.match(/<url>[\s\S]*?<\/url>/g) || [];
}

async function main() {
  var res;
  try {
    res = await fetch(BACKEND_SITEMAP_URL);
  } catch (err) {
    console.error("Nepodařilo se stáhnout " + BACKEND_SITEMAP_URL + ": " + err.message + " — sitemap.xml nechávám beze změny.");
    return;
  }
  if (!res.ok) {
    console.error("Backend odpověděl " + res.status + " na " + BACKEND_SITEMAP_URL + " — sitemap.xml nechávám beze změny.");
    return;
  }
  var backendXml = await res.text();
  var reportBlocks = extractUrlBlocks(backendXml);

  var current = fs.readFileSync(SITEMAP_PATH, "utf8");
  // Statické stránky appky (CZ/EN hlavní stránka, zásady ochrany osobních
  // údajů, ...) necháváme beze změny — mažeme a nahrazujeme jen bloky
  // reportů, které appka vygenerovala tady při minulém běhu.
  var staticBlocks = extractUrlBlocks(current).filter(function (block) {
    return block.indexOf("/report/") === -1;
  });

  var allBlocks = staticBlocks.concat(reportBlocks);
  var xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    allBlocks.map(function (b) { return "  " + b; }).join("\n") +
    "\n</urlset>\n";

  if (xml.trim() === current.trim()) {
    console.log("sitemap.xml je už aktuální (" + staticBlocks.length + " statických stránek, " + reportBlocks.length + " reportů) — nic se neměnilo.");
    return;
  }

  fs.writeFileSync(SITEMAP_PATH, xml, "utf8");
  console.log("sitemap.xml aktualizován: " + staticBlocks.length + " statických stránek + " + reportBlocks.length + " reportů z backendu.");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
