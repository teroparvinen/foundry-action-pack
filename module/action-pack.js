import { calculateUsesForItem } from "./item-uses.js";

let lastKnownActiveActor;
let currentlyActiveActor;

function fromUuid(uuid) {
    if (!uuid || uuid === '') return null;
    let parts = uuid.split('.');
    let doc;

    const [docName, docId] = parts.slice(0, 2);
    parts = parts.slice(2);
    const collection = CONFIG[docName]?.collection.instance;
    if (!collection) return null;
    doc = collection.get(docId);

    // Embedded Documents
    while (doc && parts.length > 1) {
        const [embeddedName, embeddedId] = parts.slice(0, 2);
        doc = doc.getEmbeddedDocument(embeddedName, embeddedId);
        parts = parts.slice(2);
    }
    return doc || null;
}

export function fudgeToActor(candidate) {
    // Token actors have the same UUID for the token document and the actor, try to get the actor
    if (candidate instanceof CONFIG.Actor.documentClass) {
        return candidate;
    } else if (candidate instanceof CONFIG.Token.documentClass) {
        return candidate.object.actor;
    } else {
        console.warn('Expected', candidate, 'to be actor');
    }
}

function updateCombatStatus() {
    const actors = canvas.tokens.controlled.map(t => t.actor);
    if (game.combat && actors.includes(currentlyActiveActor)) {
        $('#action-pack').addClass("is-current-combatant");
    } else {
        $('#action-pack').removeClass("is-current-combatant");
    }
}

Hooks.on("ready", () => {
    const trayHtml = `
        <div id="action-pack">
        </div>
    `;
    $('body').prepend(trayHtml);

    lastKnownActiveActor = game.combat?.turns.find(c => c.id == game.combat?.current.combatantId)?.actor;
    currentlyActiveActor = lastKnownActiveActor;

    updateCombatStatus();
});

function isTrayAutoHide() {
    const config = game.settings.get("action-pack", "tray-display");
    return config === "selected" || (config === "auto" && game.user.isGM);
}

Hooks.on("controlToken", async () => {
    if (isTrayAutoHide()) {
        if (canvas.tokens.controlled.length) {
            $('#action-pack').addClass("is-open");
        } else {
            $('#action-pack').removeClass("is-open");
        }
    }

    updateCombatStatus();
    updateTray();
});

Hooks.on("updateActor", (actor) => {
    if (canvas.tokens.controlled.map(t => t.actor).includes(actor)) {
        updateTray();
    }
});

Hooks.on("updateItem", (item) => {
    if (canvas.tokens.controlled.map(t => t.actor).includes(item.actor)) {
        updateTray();
    }
});

Hooks.on("updateCombat", (combat) => {
    currentlyActiveActor = combat.turns.find(c => c.id == combat.current.combatantId).actor
    updateCombatStatus();
    lastKnownActiveActor = currentlyActiveActor;
});

Hooks.on("deleteCombat", (combat) => {
    if (!game.combat) {
        currentlyActiveActor = null;
        lastKnownActiveActor = null;
        updateCombatStatus();
    }
})

Hooks.on("init", () => {
    game.settings.register(
        "action-pack",
        "tray-display",
        {
            name: "action-pack.settings.tray-display",
            hint: "action-pack.settings.tray-display-hint",
            scope: "client",
            config: true,
            default: "auto",
            choices: {
                auto: "action-pack.settings.tray-display-auto",
                toggle: "action-pack.settings.tray-display-toggle",
                selected: "action-pack.settings.tray-display-selected"
            },
            type: String
        }
    );
  
    game.settings.register(
        "action-pack",
        "icon-size",
        {
            name: "action-pack.settings.icon-size",
            scope: "client",
            config: true,
            default: "medium",
            choices: {
                small: "action-pack.settings.icon-size-small",
                medium: "action-pack.settings.icon-size-medium",
                large: "action-pack.settings.icon-size-large"
            },
            type: String,
            onChange: () => updateTray()
        }
    );
  
    game.settings.register(
        "action-pack",
        "use-control-button",
        {
            name: "action-pack.settings.use-control-button",
            scope: "client",
            config: true,
            default: true,
            type: Boolean,
            onChange: () => window.location.reload()
        }
    );
  
    game.settings.register(
        "action-pack",
        "show-no-uses",
        {
            name: "action-pack.settings.show-no-uses",
            scope: "client",
            config: true,
            default: false,
            type: Boolean,
            onChange: () => updateTray()
        }
    );
  
    game.keybindings.register("action-pack", "toggle-tray", {
        name: "action-pack.keybindings.toggle-tray",
        editable: [
            { key: "KeyE", modifiers: []}
        ],
        onDown: (ctx) => {
            $('#action-pack').toggleClass("is-open");
        }
    });
});

Hooks.on('getSceneControlButtons', (controls) => {
    if (game.settings.get("action-pack", "use-control-button")) {
        const token = controls.find((c) => c.name === "token");
        if (token) {
            token.tools.push({
                name: "action-pack",
                title: "action-pack.control-icon",
                icon: 'fas fa-hand-point-left',
                visible: true,
                onClick: () => {
                    $('#action-pack').toggleClass("is-open");
                },
                button: true
            });
        }
    }
});

async function updateTray() {
    const actors = canvas.tokens.controlled.map(token => {
        const actor = token.actor;
        const actorData = actor.data.data;

        const canCastUnpreparedRituals = !!actor.items.find(i => i.name === "Wizard");

        const sections = {
            equipped: { items: [], title: "action-pack.category.equipped" },
            inventory: {
                title: "action-pack.category.inventory",
                groups: {
                    weapon: { items: [], title: "action-pack.category.weapon" },
                    equipment: { items: [], title: "action-pack.category.equipment" },
                    consumable: { items: [], title: "action-pack.category.consumable" },
                    other: { items: [], title: "action-pack.category.other" }
                }
            },
            feature: { items: [], title: "action-pack.category.feature" },
            spell: {
                title: "action-pack.category.spell",
                groups: {
                    innate: { items: [], title: "action-pack.category.innate" },
                    ...[...Array(10).keys()].reduce((prev, cur) => {
                        prev[`spell${cur}`] = { items: [], title: `action-pack.category.spell${cur}` }
                        return prev;
                    }, {})
                }
            }
        }

        for (let item of actor.items) {
            const itemData = item.data.data;
            const uses = calculateUsesForItem(item);

            const hasUses = game.settings.get("action-pack", "show-no-uses") || !uses || uses.available;

            if (hasUses && itemData.activation?.type && itemData.activation.type !== "none") {
                switch (item.type) {
                case "feat":
                    sections.feature.items.push({ item, uses });
                    break;
                case "spell":
                    switch (itemData.preparation?.mode) {
                    case "prepared":
                    case "always":
                        if (itemData.preparation?.mode !== "prepared" || itemData.preparation?.prepared || (canCastUnpreparedRituals && itemData.components?.ritual)) {
                            sections.spell.groups[`spell${itemData.level}`].items.push({ item, uses });
                        }
                        break;
                    case "innate":
                        sections.spell.groups.innate.items.push({ item, uses });
                        break;
                    }
    
                    break;
                default:
                    switch (item.type) {
                    case "weapon":
                        if (itemData.equipped) {
                            sections.equipped.items.push({ item, uses });
                        } else {
                            sections.inventory.groups.weapon.items.push({ item, uses });
                        }
                        break;
                    case "equipment":
                        sections.inventory.groups.equipment.items.push({ item, uses });
                        break;
                    case "consumable":
                        if (itemData.consumableType !== "ammo") {
                            sections.inventory.groups.consumable.items.push({ item, uses });
                        }
                        break;
                    default:
                        sections.inventory.groups.other.items.push({ item, uses });
                    }
                    break;
                }
            }
        }

        function removeEmptySections(sections) {
            function hasItems(object) {
                if (!object || typeof object !== "object") { return false; }
                const keys = Object.keys(object);
                if (keys.includes("items")) { return !!object.items.length; }
                return Object.values(object).some(v => hasItems(v));
            }

            return Object.entries(sections).reduce((acc, [key, value]) => {
                if (hasItems(value)) {
                    acc[key] = value;
                }
                return acc;
            }, {});
        }

        function addSpellLevelUses(sections) {
            for (let l = 1; l <= 9; l++) {
                const group = sections.spell?.groups[`spell${l}`];
                if (group) {
                    const sl = actorData.spells[`spell${l}`];
                    group.uses = { available: sl.value, maximum: sl.max };
                }
            }

            return sections;
        }

        return {
            actor: actor,
            name: actor.name,
            sections: addSpellLevelUses(removeEmptySections(sections))
        };
    });

    const iconSize = game.settings.get("action-pack", "icon-size");
    const abilities = CONFIG.DND5E.abilities;
    const htmlString = await renderTemplate("modules/action-pack/templates/action-pack.hbs", { actors, iconSize, abilities });
    const container = $('#action-pack');
    const html = container.html(htmlString);

    function roll(event) {
        event.preventDefault();
        const itemUuid = event.currentTarget.closest(".item").dataset.itemUuid;
        const item = fromUuid(itemUuid);
        if ( item ) item.roll({}, event);
        return false;
    }

    function openSheet(event) {
        event.preventDefault();
        const itemUuid = event.currentTarget.closest(".item").dataset.itemUuid;
        const item = fromUuid(itemUuid);
        if ( item ) item.sheet.render(true);
        return false;
    }

    function hover(event, hookName) {
        const itemId = event.currentTarget.closest(".item").dataset.itemUuid;
        const item = fromUuid(itemId);
        Hooks.callAll(hookName, item, $(event.currentTarget));
    }

    html.find('.rollable .item-image').mousedown(roll);
    html.find('.rollable.item-name')
        // .on("contextmenu", roll)
        .hover(
            event => hover(event, "actorItemHoverIn"),
            event => hover(event, "actorItemHoverOut")
        );

    html.find('.rollable.item-name').mousedown(async function(event) {
        if (event.which == 2) {
            return openSheet(event);
        }

        if (event.shiftKey || event.which == 3) {
            return roll(event);
        }

        event.preventDefault();
        const li = $(event.currentTarget).parents(".item");
        const item = await fromUuid(li.data("item-uuid"));
        const chatData = item.getChatData({secrets: item.actor.isOwner});
    
        // Toggle summary
        if ( li.hasClass("expanded") ) {
          let summary = li.children(".item-summary");
          summary.slideUp(200, () => summary.remove());
        } else {
          let div = $(`<div class="item-summary">${chatData.description.value}</div>`);
          let props = $('<div class="item-properties"></div>');
          chatData.properties.forEach(p => props.append(`<span class="tag">${p}</span>`));
          div.append(props);
          li.append(div.hide());
          div.slideDown(200);
        }
        li.toggleClass("expanded");
    });

    html.find('.action-pack__ability').click(function(event) {
        const abl = this.dataset.ability;
        const actorUuid = this.closest('.action-pack__actor').dataset.actorUuid;
        const actor = fudgeToActor(fromUuid(actorUuid));
        if (abl && actor) {
            actor.rollAbility(abl, {event: event});
        }
    });

    html.find('.action-pack__end-turn').click(function(event) {
        game.combat?.nextTurn();
    });

    
}
