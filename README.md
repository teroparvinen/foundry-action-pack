# Action list tray add-on for Foundry VTT

Supports the DND5E system.

Adds a toggleable panel containing all the activatable items, abilities and spells of the currently selected actor. The panel
slides out from the left side of the screen.

## Goal

The idea of this module is to allow quick access to all the activatable items on the character sheet. This will in most cases remove
the need to have the character sheet open all the time. The list is also intended to provide a quick overview of everything, not requiring
flipping tabs on the sheet itself.

## Features

- Displays items that
    - Are spells the character can cast: Prepared spells, innate spells and rituals for wizards
    - Features that have an activation type
    - Inventory items that have an activation type, with equipped items at the top of the list
- Items with the following properties are displayed with a tag allowing them to be easily identified on the list
    - Bonus actions
    - Reactions
    - Spells that require concentration
    - Ritual spells
    - Unprepared spells (useful in conjunction with ritual)
    - Legendary actions
- Right click anywhere on the item/ability name or icon to fast forward roll (i.e. skip the activation dialog and activate)
- Click on the name of the item to expand it and reveal the item description
- Additional functions
    - Quick access to ability checks and saves through the ability links at the top of the listing
    - Quick access to the end turn function at the bottom of the list (when in combat)
    - Quick access to the character sheet by clicking on the character name

## Settings

- Hot key for toggling the tray (default: E)
- Selectable tray display modes
    - Toggle: Explicitly open and close the tray by clicking the control icon or pressing the hot key
    - When token selected: Automatically open the tray whenever a token is selected, otherwise hide it
    - Automatic: "Toggle" for players, "When token selected" for DMs
- Three size options for the item icons: Small, Medium, Large
- Hide or show the tray activation icon (left pointing finger) in the token controls
- Option to hide abilities with a set number of uses (e.g. per rest) from the list when their uses run out
