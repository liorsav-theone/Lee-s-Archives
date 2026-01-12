/**
 * Test script for monster-fetcher
 * 
 * SETUP:
 * 1. Make sure Node.js is installed (node --version)
 * 2. Run: npm init -y
 * 3. Run: npm install js-yaml
 * 4. Add "type": "module" to package.json
 * 5. Copy monster-fetcher-v2.js to this folder
 * 6. Update CONFIG.API_KEY in monster-fetcher-v2.js
 * 7. Make sure Obsidian is running with Local REST API enabled
 * 8. Run: node test.js
 */

import { 
  CONFIG,
  buildMonsterIndex, 
  getMonsterByTokenName,
  getAllMonsterNames,
  filenameToMonsterName 
} from './monster-fetcher-v2.js';

// ============================================
// TEST 1: Filename parsing (no Obsidian needed)
// ============================================

console.log('=== TEST 1: Filename Parsing ===\n');

const testFilenames = [
  'gray-ooze-xmm.md',
  'ancient-red-dragon-mm.md',
  'goblin-mm.md',
  'ooze.md',           // Should be null (note file)
  'dragons.md',        // Should be null (note file)
  'pit-fiend-xmm.md',
];

for (const filename of testFilenames) {
  const result = filenameToMonsterName(filename);
  console.log(`  "${filename}" → ${result === null ? 'SKIP (note file)' : `"${result}"`}`);
}

console.log('\n');

// ============================================
// TEST 2: Connect to Obsidian
// ============================================

console.log('=== TEST 2: Obsidian Connection ===\n');

// Check if API key is set
if (CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
  console.log('  ❌ ERROR: You need to set your API key!');
  console.log('  Open monster-fetcher-v2.js and replace YOUR_API_KEY_HERE');
  console.log('  with your actual key from Obsidian Local REST API settings.\n');
  process.exit(1);
}

console.log(`  API Key: ${CONFIG.API_KEY.slice(0, 10)}...`);
console.log(`  Base URL: ${CONFIG.BASE_URL}`);
console.log(`  Bestiary Path: ${CONFIG.BESTIARY_PATH}`);
console.log('');

// Try to connect
console.log('  Connecting to Obsidian...');

try {
  const response = await fetch(`${CONFIG.BASE_URL}/`, {
    headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}` },
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log('  ✅ Connected successfully!');
    console.log(`  Obsidian version: ${data.versions?.obsidian || 'unknown'}`);
    console.log(`  Plugin version: ${data.versions?.self || 'unknown'}`);
  } else {
    console.log(`  ❌ Connection failed: ${response.status} ${response.statusText}`);
  }
} catch (error) {
  console.log('  ❌ Connection failed:', error.message);
  console.log('');
  console.log('  Troubleshooting:');
  console.log('  1. Is Obsidian running?');
  console.log('  2. Is the "Local REST API" plugin enabled?');
  console.log('  3. Is your API key correct?');
  console.log('  4. Did you accept the certificate at https://127.0.0.1:27124 ?');
  console.log('');
  console.log('  Note: Node.js may reject self-signed certificates.');
  console.log('  Try running with: NODE_TLS_REJECT_UNAUTHORIZED=0 node test.js');
  process.exit(1);
}

console.log('\n');

// ============================================
// TEST 3: Build monster index
// ============================================

console.log('=== TEST 3: Build Monster Index ===\n');

let index;
try {
  index = await buildMonsterIndex();
  console.log('');
  console.log('  ✅ Index built successfully!');
  console.log(`  Homebrew monsters: ${index.homebrew.size}`);
  console.log(`  File-based monsters: ${index.files.size}`);
  
  // Show a few examples
  const allNames = getAllMonsterNames(index);
  console.log('');
  console.log('  First 10 monsters:');
  for (const name of allNames.slice(0, 10)) {
    console.log(`    - ${name}`);
  }
  if (allNames.length > 10) {
    console.log(`    ... and ${allNames.length - 10} more`);
  }
} catch (error) {
  console.log('  ❌ Failed to build index:', error.message);
  process.exit(1);
}

console.log('\n');

// ============================================
// TEST 4: Fetch a specific monster
// ============================================

console.log('=== TEST 4: Fetch Monster by Name ===\n');

// Try to fetch "gray ooze" or first available monster
const testNames = ['gray ooze', 'goblin', getAllMonsterNames(index)[0]];

for (const testName of testNames) {
  if (!testName) continue;
  
  console.log(`  Looking up "${testName}"...`);
  
  try {
    const monster = await getMonsterByTokenName(testName, index);
    
    if (monster) {
      console.log('  ✅ Found! Statblock preview:');
      console.log(`    Name: ${monster.name}`);
      console.log(`    Size: ${monster.size}`);
      console.log(`    Type: ${monster.type}`);
      console.log(`    AC: ${monster.ac}`);
      console.log(`    HP: ${monster.hp}`);
      console.log(`    CR: ${monster.cr}`);
      
      if (monster.actions) {
        console.log(`    Actions: ${monster.actions.length}`);
      }
      
      // Only test one successful monster
      break;
    } else {
      console.log(`  Not found, trying next...`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  console.log('');
}

console.log('\n');

// ============================================
// TEST 5: Test "not a monster" case
// ============================================

console.log('=== TEST 5: Non-Monster Token ===\n');

const fakeMonster = await getMonsterByTokenName('Gandalf the Player Character', index);
console.log(`  Looking up "Gandalf the Player Character"...`);
console.log(`  Result: ${fakeMonster === null ? 'null (correct!)' : 'ERROR - should be null'}`);

console.log('\n');
console.log('=== All tests complete! ===');