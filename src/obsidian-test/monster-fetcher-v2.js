/**
 * Obsidian Monster Fetcher
 * 
 * Handles two monster sources:
 * 1. Plugin's data.json (homebrew monsters)
 * 2. Markdown files in bestiary folder
 * 
 * Monster names are extracted from filenames:
 * - gray-ooze-xmm.md → "gray ooze" (last word is source, removed)
 * - Single-word files are notes, not monsters (ignored)
 * 
 * REQUIRES: npm install js-yaml
 */

import YAML from 'js-yaml';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  API_KEY: 'b60e2939c0d713b1bf28a6fc0c00617e32b7dc23fe441f29d542e515fc91ecfd',
  BASE_URL: 'https://127.0.0.1:27124',
  BESTIARY_PATH: 'Mechanics/compendium/bestiary',
  PLUGIN_DATA_PATH: '.obsidian/plugins/obsidian-5e-statblocks/data.json',
};


// ============================================
// API HELPER
// ============================================

async function obsidianFetch(endpoint) {
  const response = await fetch(`${CONFIG.BASE_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}` },
  });
  
  if (!response.ok) {
    throw new Error(`Obsidian API error: ${response.status}`);
  }
  
  return response;
}


// ============================================
// FILENAME PARSING
// ============================================

/**
 * Convert filename to monster name.
 * 
 * Examples:
 *   "gray-ooze-xmm.md" → "gray ooze"
 *   "ancient-red-dragon-mm.md" → "ancient red dragon"
 *   "goblin-mm.md" → "goblin"
 *   "ooze.md" → null (single word = note file, skip)
 *   "dragons.md" → null (single word = note file, skip)
 */
function filenameToMonsterName(filename) {
  // Remove .md extension
  const withoutExt = filename.replace(/\.md$/, '');
  
  // Split by dashes
  const parts = withoutExt.split('-');
  
  // Remove last word (it's the source like "xmm", "mm", etc.)
  const nameParts = parts.slice(0, -1);
  
  // If nothing left (single-word file), it's a note, not a monster
  if (nameParts.length === 0) {
    return null;
  }
  
  // Join with spaces
  return nameParts.join(' ');
}


// ============================================
// BUILD INDEX AT SESSION START
// ============================================

/**
 * Build the monster index. Call this once when session starts.
 * 
 * Returns: {
 *   homebrew: Map<name (lowercase), statblock>,
 *   files: Map<name (lowercase), filepath>,
 * }
 */
async function buildMonsterIndex() {
  console.log('Building monster index...');
  
  const homebrew = await getHomebrewMonsters();
  console.log(`Homebrew monsters: ${homebrew.size}`);
  
  const files = await indexBestiaryFiles();
  console.log(`File-based monsters: ${files.size}`);
  
  console.log(`Total indexed: ${homebrew.size + files.size} monsters`);
  
  return { homebrew, files };
}

/**
 * Get homebrew monsters from plugin's data.json
 * Returns Map with lowercase names as keys
 */
async function getHomebrewMonsters() {
  const response = await obsidianFetch(`/vault/${CONFIG.PLUGIN_DATA_PATH}`);
  const data = await response.json();
  
  const monsters = new Map();
  
  if (data.monsters && Array.isArray(data.monsters)) {
    for (const [name, statblock] of data.monsters) {
      // Store with lowercase key for case-insensitive lookup
      monsters.set(name.toLowerCase(), statblock);
    }
  }
  
  return monsters;
}

/**
 * Index bestiary files by scanning filenames.
 * No file content is read - just extracts names from filenames.
 * Returns Map with lowercase names as keys.
 */
async function indexBestiaryFiles() {
  const fileIndex = new Map();
  
  const files = await listAllMarkdownFiles(CONFIG.BESTIARY_PATH);
  console.log(`Found ${files.length} markdown files`);
  
  for (const filepath of files) {
    // Get just the filename from the path
    const filename = filepath.split('/').pop();
    
    // Convert filename to monster name
    const name = filenameToMonsterName(filename);
    
    // Skip if it's a note file (single word)
    if (name === null) {
      continue;
    }
    
    // Store with lowercase key
    fileIndex.set(name.toLowerCase(), filepath);
  }
  
  return fileIndex;
}

/**
 * Recursively list all .md files in a folder
 */
async function listAllMarkdownFiles(folderPath) {
  const response = await obsidianFetch(`/vault/${folderPath}/`);
  const data = await response.json();
  
  const mdFiles = [];
  
  for (const item of data.files || []) {
    // Folders have trailing slash: "aberration/", "beast/", etc.
    // Files don't: "goblin-mm.md", "bestiary.md"
    
    if (item.endsWith('/')) {
      // It's a subfolder - remove trailing slash and recurse
      const folderName = item.slice(0, -1); // "aberration/" → "aberration"
      const subPath = `${folderPath}/${folderName}`;
      
      try {
        const subFiles = await listAllMarkdownFiles(subPath);
        mdFiles.push(...subFiles);
      } catch (e) {
        // Skip if can't access (e.g., "img/" folder)
        console.log(`  Skipping folder: ${subPath}`);
      }
    } else if (item.endsWith('.md')) {
      // It's a markdown file
      mdFiles.push(`${folderPath}/${item}`);
    }
    // Skip non-md files (images, etc.)
  }
  
  return mdFiles;
}


// ============================================
// FETCH MONSTER DURING PLAY
// ============================================

/**
 * Search for a monster by exact name (case-insensitive).
 * This is called when DM clicks on a token.
 * 
 * @param tokenName - The name of the token (e.g., "Gray Ooze")
 * @param index - The index from buildMonsterIndex()
 * @returns Parsed statblock object, or null if not found
 */
async function getMonsterByTokenName(tokenName, index) {
  const searchKey = tokenName.toLowerCase();
  
  // Check homebrew first (already fully parsed)
  if (index.homebrew.has(searchKey)) {
    console.log(`Found "${tokenName}" in homebrew`);
    return index.homebrew.get(searchKey);
  }
  
  // Check file index
  if (index.files.has(searchKey)) {
    console.log(`Found "${tokenName}" in files, fetching...`);
    const filepath = index.files.get(searchKey);
    return await fetchAndParseStatblock(filepath);
  }
  
  // Not found (probably a player character or non-monster token)
  console.log(`"${tokenName}" is not a monster`);
  return null;
}

/**
 * Fetch a file and parse its statblock code block
 */
async function fetchAndParseStatblock(filepath) {
  const response = await obsidianFetch(`/vault/${filepath}`);
  const content = await response.text();
  
  // Extract ```statblock ... ``` block
  const match = content.match(/```statblock\n([\s\S]*?)```/);
  
  if (!match) {
    console.error(`No statblock found in ${filepath}`);
    return null;
  }
  
  // Parse the YAML content
  return parseStatblockYaml(match[1]);
}


// ============================================
// YAML PARSER (using js-yaml library)
// ============================================

/**
 * Parse Fantasy Statblocks YAML format.
 * js-yaml handles !!int type hints natively.
 */
function parseStatblockYaml(yamlString) {
  return YAML.load(yamlString);
}


// ============================================
// UTILITY: Get all monster names (for debugging/UI)
// ============================================

function getAllMonsterNames(index) {
  const homebrewNames = Array.from(index.homebrew.keys());
  const fileNames = Array.from(index.files.keys());
  return [...homebrewNames, ...fileNames].sort();
}


// ============================================
// EXPORTS
// ============================================

export {
  CONFIG,
  buildMonsterIndex,
  getMonsterByTokenName,
  getAllMonsterNames,
  filenameToMonsterName,
};