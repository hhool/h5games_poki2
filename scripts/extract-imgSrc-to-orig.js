import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read games.json
const gamesFilePath = path.join(__dirname, '../games.json');
const gamesData = JSON.parse(fs.readFileSync(gamesFilePath, 'utf-8'));

// Base directory for storing extracted files
const baseDir = path.join(__dirname, '../orig');

// Helper function to download and save a file
async function downloadAndSaveFile(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);
  console.log(`Saved: ${dest}`);
}

// Extract and process imgSrc URLs
gamesData.forEach(async (game) => {
  const imgSrc = game.imgSrc;
  if (!imgSrc) return;

  try {
    const url = new URL(imgSrc);
    const pathname = url.pathname; // e.g. /mobile/dronewars/assets/hd/LoadingScene/LoadingScene.png
    const parts = pathname.split('/'); // leading '' at index 0

    // Determine game name and relative path parts
    let gameName = '';
    let relParts = [];

    if (parts[1] === 'mobile' && parts.length > 2) {
      // /mobile/<game>/...
      gameName = parts[2];
      relParts = parts.slice(3);
    } else if (parts[1]) {
      // default: /<game>/...
      gameName = parts[1];
      relParts = parts.slice(2);
    }

    // If relative path still starts with the game name, remove duplicate
    if (relParts.length > 0 && relParts[0] === gameName) relParts = relParts.slice(1);

    // If no relative parts, use the basename of the pathname
    if (relParts.length === 0) relParts = [path.basename(pathname)];

    const firstChar = (gameName && gameName[0]) ? gameName[0].toLowerCase() : '_';

    // Construct target path: orig/<firstchar>/<gameName>/<relativePath>
    const relativePath = relParts.join('/');
    const targetPath = path.join(baseDir, firstChar, gameName, relativePath);

    // Download and save the file
    await downloadAndSaveFile(imgSrc, targetPath);
  } catch (error) {
    console.error(`Error processing ${imgSrc}:`, error);
  }
});