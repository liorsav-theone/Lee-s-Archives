import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
import { setupContextMenu } from "./contextMenu";
import { setupInitiativeList } from "./initiativeList";
import { isPlayer } from "./utils";
import { buildMonsterIndex, getMonsterByTokenName } from "./monsterFetcher";

const ID = "com.tutorial.initiative-tracker";

document.querySelector("#app").innerHTML = `
  <div class="initiative-container">
    <ul id="initiative-list"></ul>
  </div>
  <button id="next-turn-button" class="next-turn-button">Next Turn</button>
  <div id="turn-indicator" class="turn-indicator">
    <div id="turn-indicator-name" class="turn-indicator-name"></div>
    <div id="turn-indicator-hp" class="turn-indicator-hp"></div>
  </div>
`;

OBR.onReady(async () => {
  const turnIndicator = document.querySelector("#turn-indicator");
  const turnIndicatorName = document.querySelector("#turn-indicator-name");
  const turnIndicatorHP = document.querySelector("#turn-indicator-hp");

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

      // Display the statblock info
      if (statblock) {
        turnIndicatorName.textContent = statblock.name || activeCharacter.name;
        turnIndicatorHP.textContent = `HP: ${statblock.hp}`;
      } else {
        // No statblock found - just show name
        turnIndicatorName.textContent = activeCharacter.name;
        turnIndicatorHP.textContent = "";
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