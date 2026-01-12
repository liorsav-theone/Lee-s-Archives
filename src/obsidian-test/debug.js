/**
 * Debug script to see what the Obsidian API returns for folders
 */

const CONFIG = {
  API_KEY: 'b60e2939c0d713b1bf28a6fc0c00617e32b7dc23fe441f29d542e515fc91ecfd',
  BASE_URL: 'https://127.0.0.1:27124',
  BESTIARY_PATH: 'Mechanics/compendium/bestiary',
};

async function obsidianFetch(endpoint) {
  const response = await fetch(`${CONFIG.BASE_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}` },
  });
  return response;
}

async function debug() {
  console.log('=== Checking what the API returns for bestiary folder ===\n');
  
  const response = await obsidianFetch(`/vault/${CONFIG.BESTIARY_PATH}/`);
  
  console.log('Response status:', response.status);
  console.log('Content-Type:', response.headers.get('content-type'));
  console.log('');
  
  const text = await response.text();
  
  // Try to parse as JSON
  try {
    const data = JSON.parse(text);
    console.log('Parsed as JSON:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check what fields exist
    console.log('\n=== Available fields ===');
    console.log('Keys:', Object.keys(data));
    
    if (data.files) {
      console.log('\ndata.files (first 20):');
      data.files.slice(0, 20).forEach(f => console.log('  -', f));
      console.log(`... total: ${data.files.length} items`);
    }
    
  } catch (e) {
    console.log('Not JSON, raw response:');
    console.log(text.slice(0, 1000));
  }
}

debug().catch(console.error);