import { calculateUsesForItem } from "./item-uses.js";

let lastKnownActiveActor;
let currentlyActiveActor;

let scrollPosition = {};

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
    $('#interface').prepend(trayHtml);

    lastKnownActiveActor = game.combat?.turns.find(c => c.id == game.combat?.current.combatantId)?.actor;
    currentlyActiveActor = lastKnownActiveActor;

    if (isTrayAlwaysOn()) {
        $('#action-pack').addClass("is-open always-on");
    }

    updateTrayState();
});

function isTrayAutoHide() {
    const config = game.settings.get("action-pack", "tray-display");
    return config === "selected" || (config === "auto" && game.user.isGM);
}

function isTrayAlwaysOn() {
    const config = game.settings.get("action-pack", "tray-display");
    return config === "always";
}

function getActiveActors() {
    const controlled = canvas.tokens.controlled.filter(t => ["character", "npc"].includes(t.actor?.type))
    if (controlled.length) {
        return controlled.map(token => token.actor);
    }
    if (game.user.character && game.settings.get("action-pack", "assume-default-character")) {
        return [game.user.character];
    }
    return [];
}

Hooks.on("controlToken", async () => {
    updateTrayState();
});

Hooks.on("updateActor", (actor) => {
    if (getActiveActors().includes(actor)) {
        updateTray();
    }
});

function checkItemUpdate(item) {
    if (getActiveActors().includes(item.actor)) {
        updateTray();
    }
}

Hooks.on("updateItem", (item) => {
    checkItemUpdate(item);
});

Hooks.on("deleteItem", (item) => {
    checkItemUpdate(item);
});

Hooks.on("createItem", (item) => {
    checkItemUpdate(item);
});

Hooks.on("updateCombat", (combat) => {
    currentlyActiveActor = combat.turns.find(c => c.id == combat.current.combatantId)?.actor
    updateCombatStatus();
    lastKnownActiveActor = currentlyActiveActor;
});

Hooks.on("createCombatant", (combatant) => {
    if (getActiveActors().includes(combatant.actor)) {
        updateTray();
    }
});

Hooks.on("updateCombatant", (combatant, changes) => {
    if (getActiveActors().includes(combatant.actor)) {
        updateTray();
    }
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
                selected: "action-pack.settings.tray-display-selected",
                always: "action-pack.settings.tray-display-always"
            },
            type: String,
            onChange: () => {
                ui.controls.initialize();
                updateTrayState();
            }
        }
    );

    game.settings.register(
        "action-pack",
        "assume-default-character",
        {
            name: "action-pack.settings.assume-default-character",
            hint: "action-pack.settings.assume-default-character-hint",
            scope: "client",
            config: true,
            default: true,
            type: Boolean,
            onChange: () => updateTrayState()
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
        "tray-size",
        {
            name: "action-pack.settings.tray-size",
            scope: "client",
            config: true,
            default: "large",
            choices: {
                small: "action-pack.settings.tray-size-small",
                medium: "action-pack.settings.tray-size-medium",
                large: "action-pack.settings.tray-size-large"
            },
            type: String,
            onChange: () => updateTray()
        }
    );
  
    game.settings.register(
        "action-pack",
        "skill-mode",
        {
            name: "action-pack.settings.skill-mode",
            hint: "action-pack.settings.skill-mode-hint",
            scope: "client",
            config: true,
            default: "dropdown",
            choices: {
                dropdown: "action-pack.settings.skill-mode-dropdown",
                append: "action-pack.settings.skill-mode-append"
            },
            type: String,
            onChange: () => updateTray()
        }
    );
  
    game.settings.register(
        "action-pack",
        "show-spell-dots",
        {
            name: "action-pack.settings.show-spell-dots",
            scope: "client",
            config: true,
            default: true,
            type: Boolean,
            onChange: () => updateTray()
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
  
    game.settings.register(
        "action-pack",
        "sort-alphabetic",
        {
            name: "action-pack.settings.sort-alphabetic",
            scope: "client",
            config: true,
            default: false,
            type: Boolean,
            onChange: () => updateTray()
        }
    );
  
    game.settings.register(
        "action-pack",
        "show-unprepared-cantrips",
        {
            name: "action-pack.settings.show-unprepared-cantrips",
            scope: "client",
            config: true,
            default: false,
            type: Boolean,
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
  
    game.keybindings.register("action-pack", "toggle-tray", {
        name: "action-pack.keybindings.toggle-tray",
        editable: [
            { key: "KeyE", modifiers: []}
        ],
        onDown: (ctx) => {
            if (!isTrayAlwaysOn()) {
                $('#action-pack').toggleClass("is-open");
                $('#action-pack .action-pack__skill-container').removeClass("is-open");
            }
        }
    });
    game.keybindings.register("action-pack", "toggle-skills", {
        name: "action-pack.keybindings.toggle-skills",
        hint: "action-pack.keybindings.toggle-skills-hint",
        editable: [
            { key: "KeyK", modifiers: []}
        ],
        onDown: (ctx) => {
            if (game.settings.get("action-pack", "skill-mode") === "dropdown") {
                const wasSkillsOpen = $('#action-pack .action-pack__skill-container').hasClass("is-open");
                if ($('#action-pack').hasClass("is-open")) {
                    $('#action-pack .action-pack__skill-container').toggleClass("is-open");
                } else {
                    $('#action-pack').toggleClass("is-open");
                    $('#action-pack .action-pack__skill-container').addClass("is-open");
                }
    
                if (!wasSkillsOpen) {
                    scrollPosition = {};
                    const container = $('.action-pack__container');
                    if (container.length) {
                        container[0].scrollTop = 0;
                    }
                }
            } else {
                if (!$('#action-pack').hasClass("is-open")) {
                    $('#action-pack').toggleClass("is-open");
                }
                $('.action-pack__container')[0].scrollTop = $('#action-pack .action-pack__skill-container').offset().top;
            }
        }
    });
});

Hooks.on('getSceneControlButtons', (controls) => {
    if (game.settings.get("action-pack", "use-control-button") && !isTrayAlwaysOn()) {
        const token = controls.find((c) => c.name === "token");
        if (token) {
            token.tools.push({
                name: "action-pack",
                title: "action-pack.control-icon",
                icon: 'fas fa-hand-point-left',
                visible: true,
                onClick: () => {
                    $('#action-pack').toggleClass("is-open");
                    $('#action-pack .action-pack__skill-container').removeClass("is-open");
                },
                button: true
            });
        }
    }
});

function updateTrayState() {
    if (isTrayAutoHide()) {
        if (getActiveActors().length) {
            $('#action-pack').addClass("is-open");
        } else {
            $('#action-pack').removeClass("is-open");
        }
    }

    if (isTrayAlwaysOn()) {
        $('#action-pack').addClass("is-open always-on");
    } else {
        $('#action-pack').removeClass("always-on");
    }

    updateCombatStatus();
    updateTray();
}

async function updateTray() {
    const settingShowNoUses = game.settings.get("action-pack", "show-no-uses");
    const settingShowUnpreparedCantrips = game.settings.get("action-pack", "show-unprepared-cantrips");
    const settingSkillMode = game.settings.get("action-pack", "skill-mode");
    const settingSortAlphabetically = game.settings.get("action-pack", "sort-alphabetic");

    const actors = getActiveActors().map(actor => {
        const actorData = actor.system;

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
                    atwill: { items: [], title: "action-pack.category.atwill" },
                    pact: { items: [], title: "action-pack.category.pact" },
                    ...[...Array(10).keys()].reduce((prev, cur) => {
                        prev[`spell${cur}`] = { items: [], title: `action-pack.category.spell${cur}` }
                        return prev;
                    }, {})
                }
            },
            passive: { items: [], title: "action-pack.category.passive" }
        }

        for (let item of actor.items) {
            const itemData = item.system;
            const uses = calculateUsesForItem(item);

            const hasUses = settingShowNoUses || !uses || uses.available;

            if (hasUses && itemData.activation?.type && itemData.activation.type !== "none") {
                switch (item.type) {
                case "feat":
                    sections.feature.items.push({ item, uses });
                    break;
                case "spell":
                    switch (itemData.preparation?.mode) {
                    case "prepared":
                    case "always":
                        const isAlways = itemData.preparation?.mode !== "prepared";
                        const isPrepared = itemData.preparation?.prepared;
                        const isCastableRitual = (canCastUnpreparedRituals && itemData.components?.ritual);
                        const isDisplayableCantrip = itemData.level == 0 && settingShowUnpreparedCantrips;
                        if (isAlways || isPrepared || isCastableRitual || isDisplayableCantrip) {
                            sections.spell.groups[`spell${itemData.level}`].items.push({ item, uses });
                        }
                        break;
                    case "atwill":
                        sections.spell.groups.atwill.items.push({ item, uses });
                        break;
                    case "innate":
                        sections.spell.groups.innate.items.push({ item, uses });
                        break;
                    case "pact":
                        sections.spell.groups.pact.items.push({ item, uses });
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
            } else if (actor.type === "npc") {
                sections.passive.items.push({ item, uses });
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

            if (actorData.spells.pact.max) {
                sections.spell.groups.pact.uses = {
                    available: actorData.spells.pact.value,
                    maximum: actorData.spells.pact.max
                }
            }

            return sections;
        }

        function sortItems(sections) {
            Object.entries(sections).forEach(([key, value]) => {
                if (key === "items") {
                    value.sort((a, b) => {
                        if (settingSortAlphabetically) {
                            return a.item.name.localeCompare(b.item.name);
                        } else {
                            return a.item.sort - b.item.sort;
                        }
                    });
                } else if (typeof value === "object") {
                    sortItems(value);
                }
            });
            return sections;
        }

        const combatant = game.combat?.combatants.find(c => c.actor === actor);
        const needsInitiative = combatant && !combatant.initiative;

        let doShowSkills = false;
        const { uuid, showSkills } = scrollPosition;
        if (actor.uuid === uuid && showSkills) {
            doShowSkills = true;
        }
    
        return {
            actor: actor,
            name: actor.name,
            sections: addSpellLevelUses(sortItems(removeEmptySections(sections))),
            needsInitiative,
            skills: CONFIG.DND5E.skills,
            skillMode: settingSkillMode,
            showSkills: doShowSkills
        };
    });

    function prefix(tgt, str) {
        return tgt ? [str, tgt].join("-") : tgt;
    }

    const iconSize = prefix(game.settings.get("action-pack", "icon-size"), "icon");
    const traySize = prefix(game.settings.get("action-pack", "tray-size"), "tray");
    const showSpellDots = game.settings.get("action-pack", "show-spell-dots");
    const abilities = CONFIG.DND5E.abilities;
    const htmlString = await renderTemplate("modules/action-pack/templates/action-pack.hbs", { actors, iconSize, abilities, showSpellDots });
    const container = $('#action-pack');
    const html = container.html(htmlString);
    container[0].classList.remove("tray-small", "tray-medium", "tray-large");
    container[0].classList.add(traySize);

    if (actors.length == 1) {
        const currentUuid = actors[0].actor.uuid;
        const { uuid, scroll } = scrollPosition;
        if (currentUuid === uuid && scroll !== undefined) {
            html.find('.action-pack__container')[0].scrollTop = scroll;
        }
    } else {
        scrollPosition = {};
    }

    function roll(event) {
        event.preventDefault();
        const itemUuid = event.currentTarget.closest(".item").dataset.itemUuid;
        const item = fromUuid(itemUuid);
        if (item) {
            if (!game.modules.get("wire")?.active && game.modules.get("itemacro")?.active && game.settings.get("itemacro", "defaultmacro")) {
                if (item.hasMacro()) {
                    item.executeMacro();
                    return false;
                }
            }

            item.use({}, event);
        }
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
        const chatData = await item.getChatData({secrets: item.actor.isOwner});
    
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

    html.find('.rollable.item-recharge').mousedown(function(event) {
        const li = $(event.currentTarget).parents(".item");
        const item = fromUuid(li.data("item-uuid"));
        item.rollRecharge();
        event.preventDefault();
        return false;
    });

    html.find('.group-dots .dot').click(function(event) {
        const actorUuid = this.closest('.action-pack__actor').dataset.actorUuid;
        const actor = fudgeToActor(fromUuid(actorUuid));
        const group = this.closest('.group-dots').dataset.groupName;
        const slot = parseInt(this.dataset.slot) + 1;

        const current = actor.system.spells?.[group]?.value;
        if (current !== undefined) {
            const key = `system.spells.${group}.value`;
            const newValue = current !== slot ? slot : slot - 1;
            actor.update({ [key]: newValue });
        }
    });

    html.find('.action-pack__ability').click(function(event) {
        const abl = this.dataset.ability;
        const actorUuid = this.closest('.action-pack__actor').dataset.actorUuid;
        const actor = fudgeToActor(fromUuid(actorUuid));
        if (abl && actor) {
            actor.rollAbility(abl, {event: event});
        }
    });

    html.find('.action-pack__skill-row').click(function(event) {
        const skill = event.currentTarget.dataset.skill;
        const actorUuid = this.closest('.action-pack__actor').dataset.actorUuid;
        const actor = fudgeToActor(fromUuid(actorUuid));
        return actor.rollSkill(skill, { event: event });
    });
    html.find('.action-pack__skill-row').on("contextmenu", function(event) {
        const skill = event.currentTarget.dataset.skill;
        const actorUuid = this.closest('.action-pack__actor').dataset.actorUuid;
        const actor = fudgeToActor(fromUuid(actorUuid));
        return actor.rollSkill(skill, { event: event, fastForward: true });
    });

    html.find('.action-pack__skill-header').click(function(event) {
        event.target.closest('.action-pack__skill-container').classList.toggle("is-open");
    });

    html.find('.action-pack__actor-name').click(function(event) {
        const actorUuid = this.closest('.action-pack__actor').dataset.actorUuid;
        const actor = fudgeToActor(fromUuid(actorUuid));
        if (actor) {
            if (!actor.sheet.rendered) actor.sheet.render(true);
            else actor.sheet.close();
        }
    });

    html.find('.action-pack__end-turn').click(function(event) {
        game.combat?.nextTurn();
    });

    html.find('.action-pack__initiative').click(function(event) {
        const actorUuid = this.closest('.action-pack__actor').dataset.actorUuid;
        const actor = fudgeToActor(fromUuid(actorUuid));
        const combatantId = game.combat?.combatants.find(c => c.actor === actor).id;
        game.combat?.rollInitiative([combatantId]);
    });

    html.find('.action-pack__container').on("scroll", function(event) {
        if (getActiveActors().length == 1) {
            const uuid = getActiveActors()[0].uuid;
            const scroll = event.currentTarget.scrollTop;
            const showSkills = $('.action-pack__skill-container').hasClass("is-open");
            scrollPosition = { uuid, scroll , showSkills };
        } else {
            scrollPosition = {};
        }
    });
    
    Hooks.call('action-pack.updateTray', html, actors);
}

Handlebars.registerHelper({
    actionPackSlots: (available, maximum) => {
        const slots = [];
        for (let i = 0; i < maximum; i++) {
            slots.push(i < available);
        }
        return slots;
    }
});
