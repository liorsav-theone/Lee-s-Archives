/**
 * dice.js - Interactive Dice Rolling Module
 * Handles dice notation parsing, rolling, and animated result display
 * for D&D 5e stat blocks in Owlbear Rodeo
 */

// ============================================================================
// DICE ROLLER CLASS
// ============================================================================

class DiceRoller {
  constructor() {
    this.history = [];
    this.maxHistory = 50;
  }

  /**
   * Parse dice notation string into components
   * Supports: 2d6+3, 1d20-2, d8, 4d6kh3 (keep highest 3), 2d20kl1 (keep lowest/disadvantage)
   * @param {string} notation - Dice notation like "2d6+3"
   * @returns {object} Parsed dice components
   */
  parse(notation) {
    const cleaned = notation.toLowerCase().replace(/\s+/g, '');
    
    // Match pattern: [count]d[sides][keep][modifier]
    const match = cleaned.match(/^(\d*)d(\d+)(kh\d+|kl\d+)?([+-]\d+)?$/);
    
    if (!match) {
      // Check if it's just a flat modifier like "+5"
      const modMatch = cleaned.match(/^([+-]?\d+)$/);
      if (modMatch) {
        return {
          count: 0,
          sides: 0,
          modifier: parseInt(modMatch[1]),
          keep: null,
          notation: cleaned
        };
      }
      throw new Error(`Invalid dice notation: ${notation}`);
    }

    const [, countStr, sidesStr, keepStr, modStr] = match;
    
    return {
      count: countStr ? parseInt(countStr) : 1,
      sides: parseInt(sidesStr),
      modifier: modStr ? parseInt(modStr) : 0,
      keep: keepStr ? this.parseKeep(keepStr) : null,
      notation: cleaned
    };
  }

  /**
   * Parse keep notation (kh3 = keep highest 3, kl1 = keep lowest 1)
   */
  parseKeep(keepStr) {
    const match = keepStr.match(/^(kh|kl)(\d+)$/);
    if (!match) return null;
    
    return {
      type: match[1] === 'kh' ? 'highest' : 'lowest',
      count: parseInt(match[2])
    };
  }

  /**
   * Roll a single die
   * @param {number} sides - Number of sides on the die
   * @returns {number} Roll result
   */
  rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  /**
   * Roll dice based on parsed notation
   * @param {string} notation - Dice notation string
   * @returns {object} Complete roll result with breakdown
   */
  roll(notation) {
    const parsed = this.parse(notation);
    const rolls = [];
    
    // Roll all dice
    for (let i = 0; i < parsed.count; i++) {
      rolls.push({
        value: this.rollDie(parsed.sides),
        kept: true
      });
    }

    // Apply keep rules if present
    if (parsed.keep && rolls.length > 0) {
      const sortedIndices = rolls
        .map((r, i) => ({ value: r.value, index: i }))
        .sort((a, b) => parsed.keep.type === 'highest' 
          ? b.value - a.value 
          : a.value - b.value
        );

      // Mark which dice are kept
      rolls.forEach(r => r.kept = false);
      for (let i = 0; i < Math.min(parsed.keep.count, rolls.length); i++) {
        rolls[sortedIndices[i].index].kept = true;
      }
    }

    // Calculate total
    const diceTotal = rolls
      .filter(r => r.kept)
      .reduce((sum, r) => sum + r.value, 0);
    const total = diceTotal + parsed.modifier;

    // Check for critical (nat 20) or fumble (nat 1) on d20
    let critical = null;
    if (parsed.sides === 20 && parsed.count === 1) {
      if (rolls[0].value === 20) critical = 'success';
      if (rolls[0].value === 1) critical = 'fumble';
    }

    const result = {
      notation: parsed.notation,
      displayNotation: notation,
      rolls,
      modifier: parsed.modifier,
      diceTotal,
      total,
      critical,
      timestamp: Date.now()
    };

    // Add to history
    this.history.unshift(result);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    return result;
  }

  /**
   * Roll with advantage (2d20, keep highest)
   * @param {number} modifier - Modifier to add
   * @returns {object} Roll result
   */
  rollAdvantage(modifier = 0) {
    const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    return this.roll(`2d20kh1${modStr}`);
  }

  /**
   * Roll with disadvantage (2d20, keep lowest)
   * @param {number} modifier - Modifier to add
   * @returns {object} Roll result
   */
  rollDisadvantage(modifier = 0) {
    const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    return this.roll(`2d20kl1${modStr}`);
  }

  /**
   * Clear roll history
   */
  clearHistory() {
    this.history = [];
  }
}

// ============================================================================
// DICE NOTATION WRAPPER - Makes text clickable
// ============================================================================

/**
 * Wrap dice notation in text with clickable spans
 * @param {string} text - Text containing dice notation
 * @returns {string} HTML with wrapped dice notation
 */
function wrapDiceNotation(text) {
  if (!text) return '';

  // Split text by HTML tags to avoid matching inside attributes
  const parts = text.split(/(<[^>]+>)/);

  return parts.map((part) => {
    // Skip HTML tags
    if (part.startsWith('<')) {
      return part;
    }

    // Match dice patterns: 2d6+3, 1d20-2, d8, 4d6, etc.
    const diceRegex = /(\d*d\d+(?:\s*[+\-]\s*\d+)?)/gi;

    return part.replace(diceRegex, (match) => {
      const normalized = match.replace(/\s+/g, '');
      return `<span class="dice-roll" data-dice="${normalized}" role="button" tabindex="0">${match}</span>`;
    });
  }).join('');
}

/**
 * Wrap attack bonus notation (+5 to hit) with clickable spans
 * @param {string} text - Text containing attack bonuses
 * @returns {string} HTML with wrapped attack bonuses
 */
function wrapAttackBonuses(text) {
  if (!text) return '';

  let result = text;

  // Match "Attack: +X" patterns first (case insensitive)
  result = result.replace(/(Attack:\s*)([+\-]\d+)/gi, (_, prefix, bonus) => {
    return `${prefix}<span class="dice-roll" data-dice="1d20${bonus}" role="button" tabindex="0">${bonus}</span>`;
  });

  // Match "+X to hit" patterns
  result = result.replace(/([+\-]\d+)(\s+to hit)/gi, (_, bonus, suffix) => {
    return `<span class="dice-roll" data-dice="1d20${bonus}" role="button" tabindex="0">${bonus}</span>${suffix}`;
  });

  return result;
}

/**
 * Wrap saving throw DCs with clickable spans for quick d20 rolls
 * @param {string} text - Text containing DC saves
 * @returns {string} HTML with wrapped DCs
 */
function wrapSavingThrows(text) {
  if (!text) return '';
  
  // Match "DC X [Ability] saving throw" patterns
  return text.replace(/(DC\s*)(\d+)(\s+\w+\s+saving throw)/gi, (match, dc, value, suffix) => {
    return `${dc}<span class="dc-value" data-dc="${value}">${value}</span>${suffix}`;
  });
}

/**
 * Remove Obsidian markdown links and style as keywords
 * @param {string} text - Text containing Obsidian links
 * @returns {string} HTML with links converted to styled keywords
 */
function convertObsidianLinks(text) {
  if (!text) return '';

  // Match Obsidian markdown links: [text](/path/to/file.md) or [text](/path/to/file.md#anchor)
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '<span class="keyword">$1</span>');
}

/**
 * Apply all dice wrappers to text
 * @param {string} text - Raw description text
 * @returns {string} HTML with all dice notation wrapped
 */
function wrapAllDice(text) {
  if (!text) return '';

  let result = text;
  result = convertObsidianLinks(result);
  result = wrapAttackBonuses(result);
  result = wrapDiceNotation(result);
  result = wrapSavingThrows(result);

  return result;
}

// ============================================================================
// ROLL RESULT DISPLAY
// ============================================================================

/**
 * Create and show a roll result popup
 * @param {object} result - Roll result from DiceRoller
 * @param {HTMLElement} targetElement - Element that was clicked
 * @param {object} options - Display options
 */
function showRollResult(result, targetElement, options = {}) {
  // Remove any existing popups
  const existing = document.querySelector('.roll-result-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'roll-result-popup';
  
  // Add critical class if applicable
  if (result.critical === 'success') popup.classList.add('critical-success');
  if (result.critical === 'fumble') popup.classList.add('critical-fumble');

  // Build roll breakdown display
  const rollsDisplay = result.rolls.length > 0 
    ? formatRollBreakdown(result)
    : '';

  popup.innerHTML = `
    <div class="roll-header">
      <span class="roll-notation">${result.displayNotation}</span>
      ${options.label ? `<span class="roll-label">${options.label}</span>` : ''}
    </div>
    ${rollsDisplay ? `<div class="roll-breakdown">${rollsDisplay}</div>` : ''}
    <div class="roll-total ${result.critical || ''}">${result.total}</div>
    ${result.critical ? `<div class="roll-critical">${result.critical === 'success' ? 'CRITICAL!' : 'FUMBLE!'}</div>` : ''}
  `;

  document.body.appendChild(popup);

  // Position the popup
  positionPopup(popup, targetElement);

  // Animate in
  requestAnimationFrame(() => {
    popup.classList.add('visible');
  });

  // Auto-remove after delay
  const duration = options.duration || 3000;
  setTimeout(() => {
    popup.classList.add('hiding');
    setTimeout(() => popup.remove(), 300);
  }, duration);

  // Click anywhere to dismiss
  const dismissHandler = (e) => {
    if (!popup.contains(e.target)) {
      popup.classList.add('hiding');
      setTimeout(() => popup.remove(), 300);
      document.removeEventListener('click', dismissHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', dismissHandler), 100);
}

/**
 * Format the roll breakdown showing individual dice
 * @param {object} result - Roll result
 * @returns {string} HTML string
 */
function formatRollBreakdown(result) {
  if (result.rolls.length === 0) return '';

  const diceHtml = result.rolls.map(r => {
    const classes = ['die-result'];
    if (!r.kept) classes.push('dropped');
    if (r.value === result.rolls[0]?.value && result.critical === 'success') classes.push('nat20');
    if (r.value === 1 && result.rolls.length === 1) classes.push('nat1');
    return `<span class="${classes.join(' ')}">${r.value}</span>`;
  }).join(' ');

  const modifierHtml = result.modifier !== 0 
    ? `<span class="modifier">${result.modifier >= 0 ? '+' : ''}${result.modifier}</span>`
    : '';

  return `${diceHtml}${modifierHtml}`;
}

/**
 * Position popup near the target element
 * @param {HTMLElement} popup - Popup element
 * @param {HTMLElement} target - Target element that was clicked
 */
function positionPopup(popup, target) {
  const rect = target.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  
  // Default: position below and centered
  let left = rect.left + (rect.width / 2) - (popupRect.width / 2);
  let top = rect.bottom + 8;

  // Adjust if off-screen right
  if (left + popupRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popupRect.width - 10;
  }
  
  // Adjust if off-screen left
  if (left < 10) {
    left = 10;
  }

  // If off-screen bottom, position above
  if (top + popupRect.height > window.innerHeight - 10) {
    top = rect.top - popupRect.height - 8;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Initialize dice rolling click handlers on a container
 * @param {HTMLElement} container - Container element with dice notation
 * @param {DiceRoller} roller - DiceRoller instance
 * @param {object} options - Options for roll display
 */
function initDiceHandlers(container, roller, options = {}) {
  // Handle click events
  container.addEventListener('click', (e) => {
    const diceElement = e.target.closest('.dice-roll');
    if (diceElement) {
      e.preventDefault();
      const notation = diceElement.dataset.dice;
      const label = diceElement.dataset.label || null;
      
      try {
        const result = roller.roll(notation);
        showRollResult(result, diceElement, { ...options, label });
        
        // Dispatch custom event for external listeners (e.g., OBR broadcast)
        container.dispatchEvent(new CustomEvent('diceRolled', {
          detail: result,
          bubbles: true
        }));
      } catch (error) {
        console.error('Dice roll error:', error);
      }
    }
  });

  // Handle keyboard events for accessibility
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const diceElement = e.target.closest('.dice-roll');
      if (diceElement) {
        e.preventDefault();
        diceElement.click();
      }
    }
  });
}

// ============================================================================
// CSS STYLES (inject into document)
// ============================================================================

const diceStyles = `
/* Keywords (converted from Obsidian links) */
.keyword {
  color: var(--keyword-color, #646cff);
  font-weight: 500;
}

/* Clickable dice notation */
.dice-roll {
  color: var(--dice-color, #646cff);
  cursor: pointer;
  border-bottom: 1px dotted currentColor;
  transition: all 0.15s ease;
  border-radius: 2px;
  padding: 0 2px;
  margin: 0 -2px;
}

.dice-roll:hover,
.dice-roll:focus {
  background: var(--dice-hover-bg, rgba(100, 108, 255, 0.15));
  outline: none;
}

.dice-roll:active {
  transform: scale(0.95);
}

/* DC values */
.dc-value {
  font-weight: bold;
  color: var(--dc-color, #646cff);
}

/* Roll result popup */
.roll-result-popup {
  position: fixed;
  z-index: 100000;
  background: var(--popup-bg, linear-gradient(135deg, #FDF1DC 0%, #F5E6C8 100%));
  border: 2px solid var(--popup-border, #E69A28);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  text-align: center;
  min-width: 100px;
  
  /* Animation */
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}

.roll-result-popup.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.roll-result-popup.hiding {
  opacity: 0;
  transform: translateY(-5px) scale(0.98);
}

/* Critical success styling */
.roll-result-popup.critical-success {
  border-color: #FFD700;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.25),
    0 0 20px rgba(255, 215, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

/* Critical fumble styling */
.roll-result-popup.critical-fumble {
  border-color: #8B0000;
  background: linear-gradient(135deg, #F5E6C8 0%, #E8D4B8 100%);
}

.roll-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
}

.roll-notation {
  font-size: 11px;
  color: var(--notation-color, #666);
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.roll-label {
  font-size: 10px;
  color: var(--label-color, #888);
  font-style: italic;
}

.roll-breakdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.die-result {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  background: var(--die-bg, #922610);
  color: var(--die-color, #FDF1DC);
  border-radius: 4px;
  font-weight: bold;
  font-size: 13px;
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.die-result.dropped {
  opacity: 0.4;
  text-decoration: line-through;
  background: #666;
}

.die-result.nat20 {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  color: #333;
  animation: pulse-gold 0.6s ease-in-out infinite alternate;
}

.die-result.nat1 {
  background: linear-gradient(135deg, #8B0000 0%, #4A0000 100%);
}

@keyframes pulse-gold {
  from { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
  to { box-shadow: 0 0 15px rgba(255, 215, 0, 0.8); }
}

.modifier {
  font-size: 14px;
  font-weight: bold;
  color: var(--modifier-color, #333);
}

.roll-total {
  font-size: 32px;
  font-weight: bold;
  color: var(--total-color, #922610);
  line-height: 1;
  font-family: 'Libre Baskerville', Georgia, serif;
}

.roll-total.success {
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.roll-total.fumble {
  color: #8B0000;
}

.roll-critical {
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 4px;
  color: var(--critical-color, #FFD700);
  animation: bounce 0.5s ease infinite alternate;
}

@keyframes bounce {
  from { transform: scale(1); }
  to { transform: scale(1.1); }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .roll-result-popup {
    --popup-bg: linear-gradient(135deg, #2C2416 0%, #3D3225 100%);
    --popup-border: #B87333;
    --notation-color: #999;
    --die-bg: #D4926A;
    --die-color: #1a1a1a;
    --modifier-color: #E8DCC8;
    --total-color: #E8A87C;
  }
  
  .dice-roll {
    --dice-color: #D4926A;
    --dice-hover-bg: rgba(212, 146, 106, 0.2);
  }
  
  .dc-value {
    --dc-color: #D4926A;
  }
}
`;

/**
 * Inject dice styles into document
 */
function injectDiceStyles() {
  if (document.getElementById('dice-roller-styles')) return;
  
  const styleSheet = document.createElement('style');
  styleSheet.id = 'dice-roller-styles';
  styleSheet.textContent = diceStyles;
  document.head.appendChild(styleSheet);
}

// ============================================================================
// EXPORTS
// ============================================================================

// For ES modules
export {
  DiceRoller,
  wrapDiceNotation,
  wrapAttackBonuses,
  wrapSavingThrows,
  wrapAllDice,
  convertObsidianLinks,
  showRollResult,
  initDiceHandlers,
  injectDiceStyles
};

// For script tag usage (UMD-style)
if (typeof window !== 'undefined') {
  window.DiceModule = {
    DiceRoller,
    wrapDiceNotation,
    wrapAttackBonuses,
    wrapSavingThrows,
    wrapAllDice,
    convertObsidianLinks,
    showRollResult,
    initDiceHandlers,
    injectDiceStyles
  };
} 