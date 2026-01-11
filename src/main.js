import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
import { setupContextMenu } from "./contextMenu";
import { setupInitiativeList } from "./initiativeList";

document.querySelector("#app").innerHTML = `
  <div class="initiative-container">
    <ul id="initiative-list"></ul>
  </div>
  <button id="next-turn-button" class="next-turn-button">Next Turn</button>
`;

OBR.onReady(() => {

  setupContextMenu();
  setupInitiativeList(
    document.querySelector("#initiative-list"),
    document.querySelector("#next-turn-button")
  );
});