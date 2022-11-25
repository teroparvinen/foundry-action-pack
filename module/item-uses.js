// From Illandril's NPC Quick Actions by Joe Spandrusyszyn

export const calculateUsesForItem = (item) => {
    const itemData = item.system;
    const consume = itemData.consume;
    if (consume && consume.target) {
        return calculateConsumeUses(item.actor, consume);
    }
    const uses = itemData.uses;
    if (uses && (uses.max > 0 || uses.value > 0)) {
        return calculateLimitedUses(itemData);
    }

    const itemType = item.type;
    if (itemType === 'feat') {
        return calculateFeatUses(itemData);
    } else if (itemType === 'consumable') {
        return {
            available: itemData.quantity,
        };
    // } else if (itemType === 'spell') {
    //     return calculateSpellUses(item);
    } else if (itemType === 'weapon') {
        return calculateWeaponUses(itemData);
    }
    return null;
};

function calculateConsumeUses(actor, consume) {
    let available = null;
    let maximum = null;
    if (consume.type === 'attribute') {
        const value = getProperty(actor.system, consume.target);
        if (typeof value === 'number') {
            available = value;
        } else {
            available = 0;
        }
    } else if (consume.type === 'ammo' || consume.type === 'material') {
        const targetItem = actor.items.get(consume.target);
        if (targetItem) {
            available = targetItem.system.quantity;
        } else {
            available = 0;
        }
    } else if (consume.type === 'charges') {
        const targetItem = actor.items.get(consume.target);
        if (targetItem) {
            ({ available, maximum } = calculateLimitedUses(targetItem.system));
        } else {
            available = 0;
        }
    }
    if (available !== null) {
        if (consume.amount > 1) {
            available = Math.floor(available / consume.amount);
            if (maximum !== null) {
                maximum = Math.floor(maximum / consume.amount);
            }
        }
        return { available, maximum };
    }
    return null;
}

function calculateLimitedUses(itemData) {
    let available = itemData.uses.value;
    let maximum = itemData.uses.max;
    const quantity = itemData.quantity;
    if (quantity) {
        available = available + (quantity - 1) * maximum;
        maximum = maximum * quantity;
    }
    return { available, maximum };
}

function calculateFeatUses(itemData) {
    // if (itemData.recharge && itemData.recharge.value) {
    //     return { available: itemData.recharge.charged ? 1 : 0, maximum: 1 };
    // }
    return null;
}

function calculateSpellUses(item) {
    const itemData = item.system;
    const actorData = item.actor.system;
    let available = null;
    let maximum = null;
    const preparationMode = itemData.preparation.mode;
    if (preparationMode === 'pact') {
        available = actorData.spells['pact'].value;
        maximum = actorData.spells['pact'].max;
    } else if (preparationMode === 'innate' || preparationMode === 'atwill') {
        // None
    } else {
        let level = itemData.level;
        if (level > 0) {
            available = actorData.spells['spell' + level].value;
            maximum = actorData.spells['spell' + level].max;
        }
    }
    if (available === null) {
        return null;
    } else {
        return { available, maximum };
    }
}

function calculateWeaponUses(itemData) {
    // If the weapon is a thrown weapon, but not a returning weapon, show quantity
    if (itemData.properties.thr && !itemData.properties.ret) {
        return { available: itemData.quantity, maximum: null };
    }
    return null;
}
