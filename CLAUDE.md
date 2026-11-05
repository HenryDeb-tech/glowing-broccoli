# CLAUDE.md

Claude reads this file at the start of every session. It's your project's standing brief: who it's for, what it is, and the house rules. Fill in the sections marked ✏️ before you ask Claude to build anything, and update them as the project changes.

## ✏️ About this project

- **What we're building:** (one or two sentences, e.g. "A one-page microsite for a fictional congress symposium" or "A simple tracker for my professional development goals")
- **Who it's for:** (who will use it, and on what device)
- **What "done" looks like today:** (the smallest version you'd be happy to show the group at 12:30)

## ✏️ Look and feel

- **Brand:** (e.g. Wizzard: Inter for body text, Montserrat for headings; or a fictional client's colours)
- **Tone:** (e.g. clear, warm, scientific but not stuffy)
- **Reference:** (a site you like, or "clean and simple")

## About me

I'm not a developer. Explain what you're doing in plain English, keep explanations short, and avoid jargon. If you use a technical term, explain it in a few words.

## House rules

### How the project is built
- Plain HTML, CSS and JavaScript only. No frameworks, no build step and no npm packages unless I ask for them.
- `index.html` is the home page. Keep the project to a handful of files.
- The site is hosted on Vercel, which serves these files exactly as they are. Nothing needs installing or compiling.
- There is no server or database. If something needs saving, use the browser's localStorage, and tell me plainly that it only saves on this device and this browser.

### Data and safety
- This site is public. Anyone with the link can see it, and the code is on GitHub.
- Use made-up data only. Never add real client, product, patient or colleague information, even if I paste it in by mistake. If I do, stop and point it out.
- Never add passwords, API keys or other secrets.
- Keep the footer line that says this is a training exercise.

### Quality
- Make it work well on a phone as well as a laptop.
- Make it accessible: good colour contrast, alt text on images, real headings and buttons.
- Fonts from Google Fonts are fine. Images should be ones you draw yourself (SVG or CSS) or plain placeholders.

### How to work with me
- Before a big change, tell me what you plan to do in two or three bullet points.
- After each change, tell me in one or two sentences what changed and how to see it.
- Commit with short, clear messages that a non-developer would understand.
- If I ask for something that breaks these rules, say so and suggest the nearest thing that doesn't.
