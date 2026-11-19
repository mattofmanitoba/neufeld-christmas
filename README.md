# Neufeld Christmas

Family Christmas site for the Neufelds — gift exchange, wish lists, and yearly
event info, reusable year after year.

- Live site: https://mattofmanitoba.github.io/neufeld-christmas/
- Main page: Christmas event details plus one tree per giving household.
  The giver's face sits at the top of the tree; the people they give to
  decorate the tree as ornaments. Click any face for that person's page.
- Person pages: who they give to, who gives to them, wish list, and photos.
- Edit button on every page: edit text, wish lists, and photos. Edits save
  to Firebase (shared with the whole family) once configured.
- Shared password to enter the site: `family` (casual gate, not real security
  — the site is public).

## Files

- `index.html` — main page
- `person.html` — person pages (rendered from data via `?id=`)
- `styles.css`, `app.js` — styling and logic
- `data.js` — seed data (event, people, gift relationships, wish lists)
- `assets/avatars/` — cartoon avatars for all 11 family members
- `assets/photos/ava-emry/` — Ava and Emry's wish-list photos

## Editing the data

Edit `data.js` (or use the site's Edit button once Firebase is connected).
The event (year, date, time, location) is editable the same way, so next
Christmas is just an edit, not a rebuild.
