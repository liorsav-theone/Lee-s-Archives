/**
 * renderer.js - D&D 5e Stat Block Renderer
 * Converts creature data from Obsidian Fantasy Statblocks format
 * into beautiful, interactive HTML stat blocks
 */

// Import dice functions if using ES modules
// import { wrapAllDice } from './dice.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_FULL_NAMES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

const CR_TO_XP = {
  '0': '0 or 10',
  '1/8': '25',
  '1/4': '50',
  '1/2': '100',
  '1': '200',
  '2': '450',
  '3': '700',
  '4': '1,100',
  '5': '1,800',
  '6': '2,300',
  '7': '2,900',
  '8': '3,900',
  '9': '5,000',
  '10': '5,900',
  '11': '7,200',
  '12': '8,400',
  '13': '10,000',
  '14': '11,500',
  '15': '13,000',
  '16': '15,000',
  '17': '18,000',
  '18': '20,000',
  '19': '22,000',
  '20': '25,000',
  '21': '33,000',
  '22': '41,000',
  '23': '50,000',
  '24': '62,000',
  '25': '75,000',
  '26': '90,000',
  '27': '105,000',
  '28': '120,000',
  '29': '135,000',
  '30': '155,000'
};

const CR_TO_PROFICIENCY = {
  '0': 2, '1/8': 2, '1/4': 2, '1/2': 2,
  '1': 2, '2': 2, '3': 2, '4': 2,
  '5': 3, '6': 3, '7': 3, '8': 3,
  '9': 4, '10': 4, '11': 4, '12': 4,
  '13': 5, '14': 5, '15': 5, '16': 5,
  '17': 6, '18': 6, '19': 6, '20': 6,
  '21': 7, '22': 7, '23': 7, '24': 7,
  '25': 8, '26': 8, '27': 8, '28': 8,
  '29': 9, '30': 9
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate ability modifier from score
 * @param {number} score - Ability score (1-30)
 * @returns {string} Formatted modifier like "+3" or "-1"
 */
function calculateModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Get XP value for a challenge rating
 * @param {string|number} cr - Challenge rating
 * @returns {string} XP value
 */
function getXP(cr) {
  const crStr = String(cr);
  return CR_TO_XP[crStr] || '—';
}

/**
 * Get proficiency bonus for a challenge rating
 * @param {string|number} cr - Challenge rating
 * @returns {number} Proficiency bonus
 */
function getProficiency(cr) {
  const crStr = String(cr);
  return CR_TO_PROFICIENCY[crStr] || 2;
}

/**
 * Format a creature's size, type, and alignment line
 * @param {object} creature - Creature data
 * @returns {string} Formatted string
 */
function formatTypeString(creature) {
  const parts = [];
  
  if (creature.size) parts.push(creature.size);
  
  let typeStr = creature.type || 'creature';
  if (creature.subtype) {
    typeStr += ` (${creature.subtype})`;
  }
  parts.push(typeStr);
  
  if (creature.alignment) {
    parts.push(creature.alignment);
  }
  
  return parts.join(' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

/**
 * Format saving throws from creature data
 * @param {array} saves - Array of save objects like [{dexterity: 5}]
 * @returns {string} Formatted saves string
 */
function formatSaves(saves) {
  if (!saves || !Array.isArray(saves) || saves.length === 0) return null;
  
  return saves.map(save => {
    return Object.entries(save).map(([ability, bonus]) => {
      const abbrev = ability.slice(0, 3).toUpperCase();
      const sign = bonus >= 0 ? '+' : '';
      return `${abbrev} ${sign}${bonus}`;
    }).join(', ');
  }).join(', ');
}

/**
 * Format skills from creature data
 * @param {array} skills - Array of skill objects
 * @returns {string} Formatted skills string
 */
function formatSkills(skills) {
  if (!skills || !Array.isArray(skills) || skills.length === 0) return null;
  
  return skills.map(skill => {
    return Object.entries(skill).map(([name, bonus]) => {
      // Capitalize skill name
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      const sign = bonus >= 0 ? '+' : '';
      return `${formattedName} ${sign}${bonus}`;
    }).join(', ');
  }).join(', ');
}

/**
 * Ensure text has proper sentence structure
 * @param {string} text - Input text
 * @returns {string} Text with proper ending punctuation
 */
function ensureSentence(text) {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed && !trimmed.match(/[.!?]$/)) {
    return trimmed + '.';
  }
  return trimmed;
}

/**
 * Get dice wrapper function (from dice.js or fallback)
 */
function getDiceWrapper() {
  // Try to get from global (if dice.js loaded via script tag)
  if (typeof window !== 'undefined' && window.DiceModule) {
    return window.DiceModule.wrapAllDice;
  }
  // Fallback: return text unchanged
  return (text) => text;
}

// ============================================================================
// HTML GENERATION
// ============================================================================

/**
 * Create the SVG tapered rule divider
 * @returns {string} SVG HTML
 */
function createTaperedRule() {
  return `
    <svg class="tapered-rule" height="5" width="100%" preserveAspectRatio="none">
      <polyline points="0,0 400,2.5 0,5" fill="currentColor"></polyline>
    </svg>
  `;
}

/**
 * Create a property line (AC, HP, Speed, etc.)
 * @param {string} name - Property name
 * @param {string|number} value - Property value
 * @param {boolean} wrapDice - Whether to wrap dice notation
 * @returns {string} HTML string or empty if no value
 */
function createPropertyLine(name, value, wrapDice = false) {
  if (value === null || value === undefined || value === '') return '';

  // Always use the wrapper to handle Obsidian links
  const wrapFn = getDiceWrapper();

  return `
    <div class="property-line">
      <span class="property-name">${name}</span>
      <span class="property-value">${wrapFn(String(value))}</span>
    </div>
  `;
}

/**
 * Create the abilities (stats) table
 * @param {array} stats - Array of 6 ability scores [STR, DEX, CON, INT, WIS, CHA]
 * @returns {string} HTML string
 */
function createAbilitiesTable(stats) {
  const scores = stats || [10, 10, 10, 10, 10, 10];
  
  const cells = ABILITY_NAMES.map((name, i) => {
    const score = scores[i] || 10;
    const mod = calculateModifier(score);
    
    // Make ability checks clickable
    return `
      <div class="ability-score">
        <span class="ability-name">${name}</span>
        <span class="ability-value">
          <span class="score">${score}</span>
          <span class="modifier dice-roll" data-dice="1d20${mod}" data-label="${ABILITY_FULL_NAMES[i]} Check">(${mod})</span>
        </span>
      </div>
    `;
  }).join('');
  
  return `<div class="abilities-table">${cells}</div>`;
}

/**
 * Create a section of traits/actions
 * @param {array} items - Array of {name, desc} objects
 * @param {string} sectionTitle - Title for the section (or null for no header)
 * @param {string} className - CSS class for the section
 * @returns {string} HTML string
 */
function createTraitSection(items, sectionTitle = null, className = 'traits-section') {
  if (!items || !Array.isArray(items) || items.length === 0) return '';
  
  const wrapDice = getDiceWrapper();
  
  const traitsHtml = items.map(item => {
    const name = item.name || 'Unnamed';
    const desc = ensureSentence(item.desc || '');
    
    return `
      <div class="trait-block">
        <span class="trait-name">${name}.</span>
        <span class="trait-desc">${wrapDice(desc)}</span>
      </div>
    `;
  }).join('');
  
  const header = sectionTitle 
    ? `<h3 class="section-title">${sectionTitle}</h3>` 
    : '';
  
  return `
    <div class="${className}">
      ${header}
      ${traitsHtml}
    </div>
  `;
}

/**
 * Create spellcasting section with expandable spell lists
 * @param {object} spellcasting - Spellcasting data
 * @returns {string} HTML string
 */
function createSpellcastingSection(spellcasting) {
  if (!spellcasting) return '';
  
  // Handle both formats: object with properties or array of trait-like objects
  if (Array.isArray(spellcasting)) {
    return createTraitSection(spellcasting, null, 'spellcasting-section');
  }
  
  // Object format with spell slots, cantrips, etc.
  const wrapDice = getDiceWrapper();
  let html = '<div class="spellcasting-section">';
  
  if (spellcasting.desc) {
    html += `<p class="spellcasting-desc">${wrapDice(spellcasting.desc)}</p>`;
  }
  
  // Cantrips
  if (spellcasting.cantrips) {
    html += `
      <div class="spell-level">
        <span class="spell-level-name">Cantrips (at will):</span>
        <span class="spell-list">${spellcasting.cantrips.join(', ')}</span>
      </div>
    `;
  }
  
  // Spell slots by level
  if (spellcasting.spells) {
    Object.entries(spellcasting.spells).forEach(([level, data]) => {
      const slots = data.slots ? `${data.slots} slot${data.slots > 1 ? 's' : ''}` : '';
      const spells = Array.isArray(data) ? data : (data.spells || []);
      
      html += `
        <div class="spell-level">
          <span class="spell-level-name">${getOrdinal(level)} level${slots ? ` (${slots})` : ''}:</span>
          <span class="spell-list">${spells.join(', ')}</span>
        </div>
      `;
    });
  }
  
  html += '</div>';
  return html;
}

/**
 * Get ordinal string for a number
 * @param {number|string} n - Number
 * @returns {string} Ordinal like "1st", "2nd", etc.
 */
function getOrdinal(n) {
  const num = parseInt(n);
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Clean monster name by removing source suffix (e.g., "Troll (XMM)" -> "Troll")
 * @param {string} name - Monster name
 * @returns {string} Cleaned name
 */
function cleanMonsterName(name) {
  if (!name) return '';
  // Remove source suffix pattern like (XMM), (MM), (VGTM), etc.
  return name.replace(/ \([A-Z]+\)$/, '');
}

/**
 * Render a complete stat block from creature data
 * @param {object} creature - Creature data from Fantasy Statblocks
 * @param {object} options - Rendering options
 * @returns {string} Complete HTML string for the stat block
 */
function renderStatBlock(creature, options = {}) {
  if (!creature) {
    return '<div class="stat-block stat-block-error">No creature data provided</div>';
  }

  const {
    showXP = true,
    showProficiency = false,
    compactMode = false
  } = options;

  // Clean the creature name
  const cleanName = cleanMonsterName(creature.name);

  // Build CR/XP string
  let crString = '';
  if (creature.cr !== undefined && creature.cr !== null) {
    crString = String(creature.cr);
    if (showXP) {
      crString += ` (${getXP(creature.cr)} XP)`;
    }
    if (showProficiency) {
      crString += ` [Prof +${getProficiency(creature.cr)}]`;
    }
  }

  // Format HP with hit dice
  let hpString = '';
  if (creature.hp !== undefined) {
    hpString = String(creature.hp);
    if (creature.hit_dice) {
      hpString += ` (${creature.hit_dice})`;
    }
  }

  // Assemble the stat block
  const html = `
    <article class="stat-block ${compactMode ? 'compact' : ''}" role="article" aria-label="Stat block for ${cleanName || 'Unknown Creature'}">

      <!-- Header -->
      <header class="creature-header">
        <h1 class="creature-name">${cleanName || 'Unknown Creature'}</h1>
        <p class="creature-type">${formatTypeString(creature)}</p>
      </header>
      
      ${createTaperedRule()}
      
      <!-- Core Stats -->
      <section class="core-stats">
        ${createPropertyLine('Armor Class', creature.ac)}
        ${createPropertyLine('Hit Points', hpString, true)}
        ${createPropertyLine('Speed', creature.speed)}
      </section>
      
      ${createTaperedRule()}
      
      <!-- Abilities -->
      ${createAbilitiesTable(creature.stats)}
      
      ${createTaperedRule()}
      
      <!-- Secondary Stats -->
      <section class="secondary-stats">
        ${createPropertyLine('Saving Throws', formatSaves(creature.saves))}
        ${createPropertyLine('Skills', formatSkills(creature.skillsaves))}
        ${createPropertyLine('Damage Vulnerabilities', creature.damage_vulnerabilities)}
        ${createPropertyLine('Damage Resistances', creature.damage_resistances)}
        ${createPropertyLine('Damage Immunities', creature.damage_immunities)}
        ${createPropertyLine('Condition Immunities', creature.condition_immunities)}
        ${createPropertyLine('Senses', creature.senses)}
        ${createPropertyLine('Languages', creature.languages || '—')}
        ${createPropertyLine('Challenge', crString)}
      </section>
      
      ${createTaperedRule()}
      
      <!-- Traits -->
      ${createTraitSection(creature.traits, null, 'traits-section')}
      
      <!-- Spellcasting (if present) -->
      ${createSpellcastingSection(creature.spellcasting)}
      
      <!-- Actions -->
      ${createTraitSection(creature.actions, 'Actions', 'actions-section')}
      
      <!-- Bonus Actions -->
      ${createTraitSection(creature.bonus_actions, 'Bonus Actions', 'bonus-actions-section')}
      
      <!-- Reactions -->
      ${createTraitSection(creature.reactions, 'Reactions', 'reactions-section')}
      
      <!-- Legendary Actions -->
      ${creature.legendary_actions?.length ? `
        <div class="legendary-section">
          <h3 class="section-title">Legendary Actions</h3>
          ${creature.legendary_description ? `<p class="legendary-desc">${creature.legendary_description}</p>` : `
            <p class="legendary-desc">The ${(cleanName || 'creature').toLowerCase()} can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${(cleanName || 'creature').toLowerCase()} regains spent legendary actions at the start of its turn.</p>
          `}
          ${createTraitSection(creature.legendary_actions, null, 'legendary-actions-list')}
        </div>
      ` : ''}
      
      <!-- Lair Actions -->
      ${createTraitSection(creature.lair_actions, 'Lair Actions', 'lair-actions-section')}
      
      <!-- Regional Effects -->
      ${createTraitSection(creature.regional_effects, 'Regional Effects', 'regional-effects-section')}
      
      <!-- Mythic Actions -->
      ${creature.mythic_actions?.length ? `
        <div class="mythic-section">
          <h3 class="section-title">Mythic Actions</h3>
          ${creature.mythic_description ? `<p class="mythic-desc">${creature.mythic_description}</p>` : ''}
          ${createTraitSection(creature.mythic_actions, null, 'mythic-actions-list')}
        </div>
      ` : ''}
      
    </article>
  `;

  return html;
}

/**
 * Render a minimal stat block (for quick reference)
 * @param {object} creature - Creature data
 * @returns {string} Compact HTML stat block
 */
function renderCompactStatBlock(creature) {
  if (!creature) return '';
  
  const wrapDice = getDiceWrapper();
  const stats = creature.stats || [10, 10, 10, 10, 10, 10];
  
  return `
    <article class="stat-block compact">
      <header class="creature-header">
        <h1 class="creature-name">${creature.name || 'Unknown'}</h1>
        <p class="creature-type">${formatTypeString(creature)}</p>
      </header>
      
      <div class="quick-stats">
        <span class="quick-stat"><strong>AC</strong> ${creature.ac || '—'}</span>
        <span class="quick-stat"><strong>HP</strong> ${creature.hp || '—'}</span>
        <span class="quick-stat"><strong>CR</strong> ${creature.cr || '—'}</span>
      </div>
      
      <div class="abilities-inline">
        ${ABILITY_NAMES.map((name, i) => 
          `<span class="ability-inline">${name} ${stats[i]} (${calculateModifier(stats[i])})</span>`
        ).join(' ')}
      </div>
      
      ${creature.actions?.length ? `
        <div class="quick-actions">
          <strong>Actions:</strong>
          ${creature.actions.map(a => `<span class="action-name">${a.name}</span>`).join(', ')}
        </div>
      ` : ''}
    </article>
  `;
}

// ============================================================================
// CSS STYLES
// ============================================================================

const statBlockStyles = `
/* ============================================
   D&D 5e Stat Block Styles
   ============================================ */

/* CSS Custom Properties for Theming */
:root {
  --sb-font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --sb-font-heading: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

  --sb-bg-primary: rgba(42, 42, 42, 0.95);
  --sb-bg-gradient: linear-gradient(to bottom, rgba(42, 42, 42, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
  --sb-border-color: #646cff;
  --sb-heading-color: #ffffff;
  --sb-text-color: rgba(255, 255, 255, 0.9);
  --sb-property-color: #646cff;
  --sb-rule-color: rgba(255, 255, 255, 0.2);
  --sb-shadow-color: rgba(0, 0, 0, 0.3);

  --sb-border-radius: 8px;
  --sb-padding: 16px;
  --sb-max-width: 400px;
}

/* Light Mode */
@media (prefers-color-scheme: light) {
  :root {
    --sb-bg-primary: rgba(255, 255, 255, 0.95);
    --sb-bg-gradient: linear-gradient(to bottom, rgba(255, 255, 255, 0.95) 0%, rgba(245, 245, 245, 0.95) 100%);
    --sb-border-color: #646cff;
    --sb-heading-color: #1a1a1a;
    --sb-text-color: rgba(0, 0, 0, 0.9);
    --sb-property-color: #646cff;
    --sb-rule-color: rgba(0, 0, 0, 0.1);
    --sb-shadow-color: rgba(0, 0, 0, 0.1);
  }
}

/* Main Container */
.stat-block {
  font-family: var(--sb-font-body);
  font-size: 13.5px;
  line-height: 1.35;
  color: var(--sb-text-color);
  background: var(--sb-bg-gradient);
  padding: var(--sb-padding);
  max-width: var(--sb-max-width);
  box-shadow: 
    0 0 0 1px var(--sb-border-color),
    0 0 8px var(--sb-shadow-color);
  position: relative;
  overflow-y: auto;
  max-height: 100%;
}

/* Decorative top/bottom borders */
.stat-block::before,
.stat-block::after {
  content: '';
  display: block;
  height: 3px;
  background: var(--sb-border-color);
  margin: -16px -16px 12px;
  border-radius: var(--sb-border-radius) var(--sb-border-radius) 0 0;
}

.stat-block::after {
  margin: 12px -16px -16px;
  border-radius: 0 0 var(--sb-border-radius) var(--sb-border-radius);
}

/* Error State */
.stat-block-error {
  padding: 20px;
  text-align: center;
  color: #922610;
  font-style: italic;
}

/* Creature Header */
.creature-header {
  margin-bottom: 2px;
}

.creature-name {
  font-family: var(--sb-font-heading);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--sb-heading-color);
  margin: 0 0 4px;
  line-height: 1.2;
}

.creature-type {
  font-size: 13px;
  font-style: italic;
  margin: 0;
  color: var(--sb-text-color);
  opacity: 0.8;
}

/* Tapered Rule Divider */
.tapered-rule {
  display: block;
  width: 100%;
  height: 5px;
  margin: 8px 0;
  color: var(--sb-rule-color);
  fill: currentColor;
}

/* Property Lines (AC, HP, Speed, etc.) */
.property-line {
  margin: 2px 0;
  line-height: 1.4;
}

.property-name {
  font-weight: 700;
  color: var(--sb-property-color);
}

.property-name::after {
  content: ' ';
}

.property-value {
  color: var(--sb-text-color);
}

/* Abilities Table */
.abilities-table {
  display: flex;
  justify-content: space-between;
  text-align: center;
  padding: 6px 0;
  gap: 4px;
}

.ability-score {
  flex: 1;
  min-width: 0;
}

.ability-name {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--sb-heading-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ability-value {
  display: block;
  font-size: 12px;
  color: var(--sb-text-color);
}

.ability-value .score {
  font-weight: 600;
}

.ability-value .modifier {
  color: var(--sb-property-color);
}

/* Section Titles */
.section-title {
  font-family: var(--sb-font-heading);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--sb-heading-color);
  border-bottom: 2px solid var(--sb-rule-color);
  margin: 16px 0 8px;
  padding-bottom: 6px;
  text-transform: uppercase;
}

/* Remove top margin for first section title after stats */
.secondary-stats + .tapered-rule + .section-title,
.secondary-stats + .tapered-rule + * .section-title:first-child {
  margin-top: 8px;
}

/* Trait Blocks */
.trait-block {
  margin: 8px 0;
  text-align: justify;
  text-justify: inter-word;
}

.trait-name {
  font-weight: 700;
  font-style: italic;
  color: var(--sb-text-color);
}

.trait-desc {
  color: var(--sb-text-color);
}

/* Legendary/Mythic Descriptions */
.legendary-desc,
.mythic-desc {
  font-style: italic;
  margin: 0 0 8px;
  font-size: 12px;
}

/* Spellcasting */
.spellcasting-section {
  margin: 8px 0;
}

.spellcasting-desc {
  margin: 0 0 6px;
}

.spell-level {
  margin: 4px 0;
  padding-left: 1em;
  text-indent: -1em;
}

.spell-level-name {
  font-style: italic;
}

.spell-list {
  font-style: italic;
  color: var(--sb-text-color);
}

/* Compact Mode */
.stat-block.compact {
  font-size: 12px;
  padding: 10px 12px;
}

.stat-block.compact .creature-name {
  font-size: 16px;
}

.stat-block.compact .section-title {
  font-size: 14px;
  margin: 10px 0 6px;
}

.quick-stats {
  display: flex;
  gap: 12px;
  margin: 8px 0;
  font-size: 12px;
}

.quick-stat strong {
  color: var(--sb-property-color);
}

.abilities-inline {
  font-size: 11px;
  color: var(--sb-text-color);
  margin: 6px 0;
}

.ability-inline {
  margin-right: 8px;
  white-space: nowrap;
}

.quick-actions {
  font-size: 11px;
  margin-top: 8px;
}

.quick-actions .action-name {
  font-style: italic;
}

/* Scrollbar Styling */
.stat-block::-webkit-scrollbar {
  width: 8px;
}

.stat-block::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

.stat-block::-webkit-scrollbar-thumb {
  background: var(--sb-border-color);
  border-radius: 4px;
}

.stat-block::-webkit-scrollbar-thumb:hover {
  background: var(--sb-heading-color);
}

/* Print Styles */
@media print {
  .stat-block {
    box-shadow: none;
    border: 2px solid var(--sb-border-color);
    max-height: none;
    break-inside: avoid;
  }
}

/* Animations */
@keyframes statblock-fadein {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stat-block {
  animation: statblock-fadein 0.3s ease-out;
}
`;

/**
 * Inject stat block styles into document
 */
function injectStatBlockStyles() {
  if (document.getElementById('statblock-renderer-styles')) return;
  
  const styleSheet = document.createElement('style');
  styleSheet.id = 'statblock-renderer-styles';
  styleSheet.textContent = statBlockStyles;
  document.head.appendChild(styleSheet);
}

/**
 * Load Google Fonts for stat block typography
 */
function loadStatBlockFonts() {
  if (document.getElementById('statblock-fonts')) return;
  
  const link = document.createElement('link');
  link.id = 'statblock-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Noto+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap';
  document.head.appendChild(link);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the stat block renderer
 * Injects styles and loads fonts
 */
function initRenderer() {
  loadStatBlockFonts();
  injectStatBlockStyles();
}

// ============================================================================
// EXPORTS
// ============================================================================

// ES Module exports
export {
  renderStatBlock,
  renderCompactStatBlock,
  initRenderer,
  injectStatBlockStyles,
  loadStatBlockFonts,
  calculateModifier,
  getXP,
  getProficiency,
  formatTypeString,
  formatSaves,
  formatSkills,
  ABILITY_NAMES,
  CR_TO_XP,
  CR_TO_PROFICIENCY
};

// UMD-style global export for script tag usage
if (typeof window !== 'undefined') {
  window.StatBlockRenderer = {
    render: renderStatBlock,
    renderCompact: renderCompactStatBlock,
    init: initRenderer,
    injectStyles: injectStatBlockStyles,
    loadFonts: loadStatBlockFonts,
    utils: {
      calculateModifier,
      getXP,
      getProficiency,
      formatTypeString,
      formatSaves,
      formatSkills
    },
    constants: {
      ABILITY_NAMES,
      CR_TO_XP,
      CR_TO_PROFICIENCY
    }
  };
}