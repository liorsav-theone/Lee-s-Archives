import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
import { setupContextMenu } from "./contextMenu";
import { setupInitiativeList } from "./initiativeList";
import { isPlayer } from "./utils";
import { buildMonsterIndex, getMonsterByTokenName } from "./monsterFetcher";
import { renderStatBlock, initRenderer } from "./renderer";
import { DiceRoller, initDiceHandlers, injectDiceStyles } from "./dice";

const ID = "com.tutorial.initiative-tracker";

document.querySelector("#app").innerHTML = `
  <div class="initiative-container">
    <ul id="initiative-list"></ul>
  </div>
  <button id="next-turn-button" class="next-turn-button">Next Turn</button>
  <div id="turn-indicator" class="turn-indicator">
    <div id="turn-indicator-content"></div>
  </div>
`;

OBR.onReady(async () => {
  // Initialize renderer and dice modules
  initRenderer();
  injectDiceStyles();
  const diceRoller = new DiceRoller();

  const turnIndicator = document.querySelector("#turn-indicator");
  const turnIndicatorContent = document.querySelector("#turn-indicator-content");

  // Build monster index on load
  console.log("Building monster index...");
  const monsterIndex = await buildMonsterIndex();
  console.log("Monster index ready!");

  // Function to update the turn indicator
  const updateTurnIndicator = async (activeCharacter) => {
    // Only show turn indicator for NPCs (not players)
    if (activeCharacter && !isPlayer(activeCharacter)) {
      // Check if we already have the statblock in metadata
      const metadata = activeCharacter.metadata[`${ID}/metadata`];
      let statblock = metadata?.statblock;

      // If not cached, fetch it
      if (statblock === undefined) {
        statblock = await getMonsterByTokenName(activeCharacter.name, monsterIndex);

        // Store in metadata (even if null, to avoid re-fetching)
        await OBR.scene.items.updateItems([activeCharacter], (items) => {
          for (let item of items) {
            const meta = item.metadata[`${ID}/metadata`];
            if (meta) {
              meta.statblock = statblock;
              item.metadata[`${ID}/metadata`] = meta;
            }
          }
        });
      }

      // Display the full statblock
      if (statblock) {
        // Render the full stat block using the renderer
        const statBlockHtml = renderStatBlock(statblock);
        turnIndicatorContent.innerHTML = statBlockHtml;

        // Initialize dice handlers for the stat block
        initDiceHandlers(turnIndicatorContent, diceRoller);
      } else {
        // No statblock found - just show name
        turnIndicatorContent.innerHTML = `
          <div class="npc-name-fallback">
            <div class="npc-name">${activeCharacter.name}</div>
            <div class="npc-no-stats">No stat block found</div>
          </div>
        `;
      }

      turnIndicator.classList.add("visible");
    } else {
      turnIndicator.classList.remove("visible");
    }
  };

  setupContextMenu();
  setupInitiativeList(
    document.querySelector("#initiative-list"),
    document.querySelector("#next-turn-button"),
    updateTurnIndicator
  );
});