#!/usr/bin/env node
/* generate-tag-pages.cjs — CommonJS copy of generate-tag-pages.js */
const fs   = require('fs');
const path = require('path');

const BASE_URL  = 'https://poki2.online';
const SITE_NAME = 'Poki2';
const DIST      = path.join(__dirname, '..', 'dist');
const GAMES     = path.join(__dirname, '..', 'games.json');
const MIN_GAMES  = 5;
const PAGE_SIZE  = 24;

const CRITICAL_CSS_PATH = path.join(__dirname, '..', 'css', 'critical.css');
let CRITICAL_CSS = '';
try {
	if (fs.existsSync(CRITICAL_CSS_PATH)) {
		CRITICAL_CSS = fs.readFileSync(CRITICAL_CSS_PATH, 'utf8');
	} else {
		CRITICAL_CSS = `html,body{height:100%}html:not(.css-ready) body{visibility:hidden;opacity:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f0f2f5;color:#1e1e2e;margin:0}h1, .hero-title{font-size:1.8rem;font-weight:800;margin:0 0 .5rem}p, .hero-sub{margin:0 0 1rem;opacity:.9} .hero{padding:28px 16px;text-align:center;color:#fff;background:linear-gradient(135deg,#009cff 0%,#6c3bff 100%)}.tag-intro{padding:12px 20px}html.has-js .tag-intro, html.has-js noscript, html.has-js #related-tags{display:none !important;visibility:hidden !important;}`;
	}
} catch (e) {
	CRITICAL_CSS = `html:not(.css-ready) body{visibility:hidden;opacity:0}html.has-js .tag-intro, html.has-js noscript, html.has-js #related-tags{display:none !important;visibility:hidden !important;}`;
}

const TAG_CONFIG = {
	puzzle:      { label: 'Puzzle', headline: 'Free Online Puzzle Games', desc: 'Challenge your brain with the best free puzzle games online. Solve riddles, match tiles, and test your logic — all playable instantly in your browser.' },
	adventure:   { label: 'Adventure', headline: 'Free Online Adventure Games', desc: 'Embark on epic quests and explore unknown worlds in the best free adventure games online. Play instantly in your browser — no download or install required.' },
	shooting:    { label: 'Shooting', headline: 'Free Online Shooting Games', desc: 'Lock and load with the best free shooting games online. Aim, fire, and take down enemies in fast-paced action — playable in any browser on desktop and mobile.' },
	action:      { label: 'Action', headline: 'Free Online Action Games', desc: 'Dive into non-stop thrills with the best free action games online. Fast reflexes and epic battles await — all available to play instantly in your browser.' },
	racing:      { label: 'Racing', headline: 'Free Online Racing Games', desc: 'Hit the gas with the best free racing games online. Speed through challenging tracks, dodge rivals, and chase first place — playable instantly in your browser.' },
	sports:      { label: 'Sports', headline: 'Free Online Sports Games', desc: 'Compete in the best free online sports games — from basketball to soccer. Play solo or challenge opponents and climb the leaderboard. No download needed.' },
	strategy:    { label: 'Strategy', headline: 'Free Online Strategy Games', desc: 'Outthink your opponents with the best free strategy games online. Plan every move, manage resources, and dominate the battlefield. Play instantly in your browser.' },
	multiplayer: { label: 'Multiplayer', headline: 'Free Online Multiplayer Games', desc: 'Play with or against friends in the best free multiplayer games online. Challenge real players worldwide in real-time — no download, no install, just play instantly.' },
	idle:        { label: 'Idle', headline: 'Free Online Idle & Clicker Games', desc: 'Sit back and let the numbers grow in the best free idle games online. Upgrade, automate, and unlock powerful boosts — instant play, no download required.' },
	arcade:      { label: 'Arcade', headline: 'Free Online Arcade Games', desc: 'Relive the golden age of gaming with the best free arcade games online. Simple controls, addictive gameplay, and high scores to chase. Play instantly in any browser.' },
	platformer:  { label: 'Platformer', headline: 'Free Online Platformer Games', desc: 'Jump, run, and dodge through dangerous levels in the best free platformer games online. Classic side-scrolling action playable instantly in your browser.' },
	competitive: { label: 'Competitive', headline: 'Free Online Competitive Games', desc: 'Rise to the top in the best free competitive games online. Go head-to-head, prove your skills, and claim the number one spot. Play now in your browser.' },
};

function esc(str){ return (str||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function normalizeHref(link){ try { const u=new URL(link); let p=u.pathname.replace(/\/+$/,''); if(!p)p=u.hostname.split('.')[0]; return p.split('/').pop()||link;}catch{return link;} }
function extractBody(htmlFile){ const src=fs.readFileSync(htmlFile,'utf8'); const m=src.match(/<body[^>]*>([\s\S]*)<\/body>/i); if(!m) throw new Error(`Could not extract <body> from ${htmlFile}`); return { open: src.match(/<body([^>]*)>/i)[0], inner: m[1] }; }

if (!fs.existsSync(GAMES)) { console.error('games.json not found'); process.exit(1); }
const indexHtml = path.join(DIST,'index.html'); if(!fs.existsSync(indexHtml)){ console.error('dist/index.html not found — run build:copy first'); process.exit(1); }

const allGames = JSON.parse(fs.readFileSync(GAMES,'utf8')).filter(g=>g.show!==false);
const TAG_PAGES_KEYS = Object.keys(TAG_CONFIG);

const { open: bodyTag, inner: bodyInner } = extractBody(indexHtml);
const sanitizedBody = bodyInner.replace(/<section class="tag-intro">[\s\S]*?<\/section>/gi,'');
const gameBodyContent = sanitizedBody.replace(/<\/body>\s*$/i,'').replace(/<h1(\s[^>]*)?>What are you playing today\?<\/h1>/i,'<p$1>What are you playing today?</p>');

let count = 0;
for(const [tag, cfg] of Object.entries(TAG_CONFIG)){
	const tagGames = allGames.filter(g => (g.tags||[]).includes(tag));
	if(tagGames.length < MIN_GAMES) continue;
	const pageGames = tagGames.slice(0, PAGE_SIZE);
	const dir = path.join(DIST, 'tag', tag);
	fs.mkdirSync(dir, { recursive: true });
	// Simplified: write minimal page using cfg and pageGames
	fs.writeFileSync(path.join(dir,'index.html'), `<html><head><title>${esc(cfg.headline)}</title></head><body><h1>${esc(cfg.headline)}</h1><p>${esc(cfg.desc)}</p></body></html>`, 'utf8');
	console.log(`  /tag/${tag}/  (${tagGames.length} games)`);
	count++;
}
console.log(`\u2705  Generated ${count} tag pages in dist/tag/`);
