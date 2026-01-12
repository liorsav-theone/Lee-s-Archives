/**
 * Check if a character is a player character
 * @param {Object} character - The character item from OBR
 * @returns {boolean} True if the character is a player, false otherwise
 */
export function isPlayer(character) {
  return character && character.name === "Mirabel Mira Thorne";
}
