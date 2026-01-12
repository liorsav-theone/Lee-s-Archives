import OBR from "@owlbear-rodeo/sdk";

const ID = "com.tutorial.initiative-tracker";

export function setupInitiativeList(element, buttonElement, onTurnChange) {
    let currentTurnIndex = 0;
    let sortedItems = [];

    const renderList = (items) => {
        // Get the name and initiative of any item with
        // our initiative metadata
        const initiativeItems = [];
        for (const item of items) {
            const metadata = item.metadata[`${ID}/metadata`];
            if (metadata) {
                initiativeItems.push({
                    initiative: metadata.initiative,
                    name: item.name,
                    id: item.id,
                    active: metadata.active || false,
                });
            }
        }

        // Sort so the highest initiative value is on top
        sortedItems = initiativeItems.sort(
            (a, b) => parseFloat(b.initiative) - parseFloat(a.initiative)
        );

        // Find the active turn index
        const activeIndex = sortedItems.findIndex(item => item.active);
        if (activeIndex !== -1) {
            currentTurnIndex = activeIndex;
        }

        // Enable/disable next turn button
        if (buttonElement) {
            buttonElement.disabled = sortedItems.length <= 1;
        }

        // Create new list nodes for each initiative item
        const nodes = [];
        for (let i = 0; i < sortedItems.length; i++) {
            const initiativeItem = sortedItems[i];
            const listItem = document.createElement("li");
            listItem.className = "initiative-item";

            // Add active class to the current turn
            if (i === currentTurnIndex) {
                listItem.classList.add("active-turn");
            }

            // Click handler to skip to this character's turn
            listItem.addEventListener("click", (e) => {
                // Don't trigger if clicking on the input field
                if (e.target.tagName === "INPUT") return;

                // Find the item in the full items list and update active state
                OBR.scene.items.getItems().then((items) => {
                    // Find the full item details for the active character
                    const activeItem = items.find(item => item.id === initiativeItem.id);

                    OBR.scene.items.updateItems(items, (itemsToUpdate) => {
                        for (let item of itemsToUpdate) {
                            const metadata = item.metadata[`${ID}/metadata`];
                            if (metadata) {
                                metadata.active = item.id === initiativeItem.id;
                                item.metadata[`${ID}/metadata`] = metadata;
                            }
                        }
                    });

                    // Select the character
                    OBR.player.select([initiativeItem.id]);

                    // Update turn indicator
                    if (onTurnChange && activeItem) {
                        onTurnChange(activeItem);
                    }
                });
            });

            const nameContainer = document.createElement("div");
            nameContainer.className = "initiative-name";
            nameContainer.textContent = initiativeItem.name;

            // Create editable input for initiative value
            const initiativeInput = document.createElement("input");
            initiativeInput.type = "number";
            initiativeInput.className = "initiative-value";
            initiativeInput.value = initiativeItem.initiative;

            // Handle initiative value changes
            initiativeInput.addEventListener("change", (e) => {
                const newValue = e.target.value;

                // Update the item's metadata with the new initiative
                OBR.scene.items.getItems().then((items) => {
                    OBR.scene.items.updateItems(items, (itemsToUpdate) => {
                        for (let item of itemsToUpdate) {
                            if (item.id === initiativeItem.id) {
                                const metadata = item.metadata[`${ID}/metadata`];
                                if (metadata) {
                                    metadata.initiative = newValue;
                                    item.metadata[`${ID}/metadata`] = metadata;
                                }
                            }
                        }
                    });
                });
            });

            // Prevent input from losing focus on click
            initiativeInput.addEventListener("click", (e) => {
                e.stopPropagation();
            });

            listItem.appendChild(nameContainer);
            listItem.appendChild(initiativeInput);
            nodes.push(listItem);
        }

        if (nodes.length === 0) {
            const emptyState = document.createElement("div");
            emptyState.className = "empty-state";
            emptyState.textContent = "No characters in initiative";
            element.replaceChildren(emptyState);
        } else {
            element.replaceChildren(...nodes);
        }
    };

    // Next turn button handler
    if (buttonElement) {
        buttonElement.addEventListener("click", () => {
            if (sortedItems.length <= 1) return;

            // Move to next turn (wrap around to 0 if at the end)
            currentTurnIndex = (currentTurnIndex + 1) % sortedItems.length;

            // Get the ID of the character whose turn it is
            const activeCharacterId = sortedItems[currentTurnIndex].id;

            // Update all items to mark the new active one
            OBR.scene.items.getItems().then((items) => {
                // Find the full item details for the active character
                const activeItem = items.find(item => item.id === activeCharacterId);

                OBR.scene.items.updateItems(items, (itemsToUpdate) => {
                    for (let item of itemsToUpdate) {
                        const metadata = item.metadata[`${ID}/metadata`];
                        if (metadata) {
                            // Set active flag based on whether this is the current turn
                            metadata.active = item.id === activeCharacterId;
                            item.metadata[`${ID}/metadata`] = metadata;
                        }
                    }
                });

                // Select the character whose turn it is
                OBR.player.select([activeCharacterId]);

                // Update turn indicator
                if (onTurnChange && activeItem) {
                    onTurnChange(activeItem);
                }
            });
        });
    }

    OBR.scene.items.onChange(renderList);
}