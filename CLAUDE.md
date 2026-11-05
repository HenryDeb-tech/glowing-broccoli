# CLAUDE.md

Claude reads this file at the start of every session. It's your project's standing brief: who it's for, what it is, and the house rules. Update the sections marked ✏️ as the project changes.

## ✏️ About this project

- **What we're building:** An interactive audience participation app for **internal meetings inside pharma and healthcare client organisations**, such as brand team workshops, sales meetings and internal launches. It is not HCP-facing. Built and owned by Wizzard (London-based creative and medical communications agency).
- **Who it's for:** Client staff create and run their own sessions. Attendees join anonymously on their phones, and results show live on a shared big-screen display in the room. Each client organisation sees its own branding throughout.
- **What "done" looks like today:** (✏️ fill in: the smallest version you'd be happy to show the group, e.g. "a working live poll: host sets a question, attendee view to vote, big-screen view of results")

### Core users

- **Host**: a member of client staff. Creates sessions, builds activities, runs the session live, reviews past sessions on a dashboard.
- **Attendee**: anyone in the room. Scans a QR code or enters a short code on their phone. No sign-in, no name, no personal data.
- **Big-screen display**: a presenter view shown on the room screen or projector, showing the current activity and live results.
- **Wizzard admin** (assumed): sets up client organisations, their branding and their host accounts.

### Meeting format

- In-person only for now: attendees on phones, results on a shared screen.
- Typical large session: **50 to 200 attendees**.
- Remote or hybrid participation is out of scope for v1.

### Features, in build order

1. **Live polls and quizzes**: single and multiple choice; quiz mode with correct answers.
2. **Q&A with upvoting**: attendees submit questions and upvote others; host sees them ranked.
3. **Word clouds and open text responses**: free-text answers, word cloud on the big screen.
4. **Post-session feedback and ratings**: short rating and comment form at the end of a session.

Build and finish each one end to end (host setup, attendee phone view, big-screen view, saved results) before starting the next.

### After the session

- Hosts get a **dashboard of past sessions** showing each session's activities and results.
- Out of scope for v1: CSV/Excel/PDF exports, automatic data deletion.

## ✏️ Look and feel

- **Brand:** Branding is set per **client organisation**: logo, primary colour, secondary colour. Use **fictional client organisations only** (see Data and safety). Wizzard's own look: Inter for body text, Montserrat for headings.
- **How branding is applied:** to the attendee phone view, the big-screen view and the host area. Store each organisation's colours as theme settings (CSS variables) loaded from that organisation's record, never typed directly into the page styles.
- **Readable on any colour:** check text contrast against each client colour and switch automatically to light or dark text so it always stays readable.
- **Attendee view:** mobile-first. Must work in a phone browser with no app install, on weak venue Wi-Fi, and recover cleanly if the connection drops.
- **Big-screen view:** designed for a projector: large type, high contrast, readable from the back of a room.
- **Tone:** (✏️ e.g. clear, warm, scientific but not stuffy)
- **Reference:** (✏️ a site you like, or "clean and simple")

## About me

I'm not a developer. Explain what you're doing in plain English, keep explanations short, and avoid jargon. If you use a technical term, explain it in a few words.

## House rules

These rules take priority. Where the product brief above asks for something they don't allow, build the nearest version that fits and tell me.

### How the project is built
- Plain HTML, CSS and JavaScript only. No frameworks, no build step and no npm packages unless I ask for them.
- `index.html` is the home page. Keep the project to a handful of files.
- The site is hosted on Vercel, which serves these files exactly as they are. Nothing needs installing or compiling.
- There is no server or database. If something needs saving, use the browser's localStorage, and tell me plainly that it only saves on this device and this browser.
  - This means real live voting across many phones isn't possible in this version. Simulate it instead (for example, host, attendee and big-screen views in separate tabs of the same browser, or made-up sample votes), and say clearly that it's a simulation.

### Data and safety
- This site is public. Anyone with the link can see it, and the code is on GitHub.
- Use made-up data only. Never add real client, product, patient or colleague information, even if I paste it in by mistake. If I do, stop and point it out.
- Never add passwords, API keys or other secrets.
- Keep the footer line that says this is a training exercise.

### Product rules (fit within the house rules)
- **Anonymous attendees.** Give each attendee a random participant ID stored on their device so they can't vote twice in the same poll. Never ask for or store names, emails or other identifying details.
- **Session codes** are short, easy to type and unambiguous (avoid 0/O and 1/I/L). Each session also gets a QR code linking straight to the join page (drawn in the browser, no outside packages unless I agree).
- **Keep each organisation's data separate.** Tag every saved item with its organisation so one client's sessions never show for another.
- **Smooth big screen.** Update the big-screen results in small batches every few hundred milliseconds rather than redrawing on every single vote.

### Quality
- Make it work well on a phone as well as a laptop.
- Make it accessible: good colour contrast, alt text on images, real headings and buttons, keyboard navigation and clear focus outlines.
- UK English in all user-facing copy.
- Fonts from Google Fonts are fine. Images should be ones you draw yourself (SVG or CSS) or plain placeholders.

### How to work with me
- Don't build anything until asked. Keep features in the build order above.
- Before a big change, tell me what you plan to do in two or three bullet points. Ask before any significant change to how the app is put together.
- After each change, tell me in one or two sentences what changed and how to see it.
- Commit with short, clear messages that a non-developer would understand.
- If I ask for something that breaks these rules, say so and suggest the nearest thing that doesn't.

## Future production version (not for this project)

For reference only. A real, live version would need things this training project deliberately doesn't have, so don't build any of this unless I explicitly change the house rules.

- **Suggested stack:** Next.js (App Router) with TypeScript; Tailwind CSS with theme values from CSS variables; Supabase (Postgres database, email sign-in for hosts, Realtime for live updates); Vercel hosting. Prefer an EU/UK region for the database, given the UK pharma client base.
- **Multi-tenant from day one:** every table holding client data carries an `organisation_id`, with Postgres row-level security so hosts only ever see their own organisation's data.
- **Scale:** 200 attendees per session sits well within Supabase Realtime limits.

## Open questions (to settle before or during build)

- Who creates client organisations and host accounts: Wizzard admins, or clients signing up themselves?
- Q&A moderation: should hosts approve questions before they show on the big screen?
- Quizzes: do we want scores or a leaderboard? (Leaderboards need some attendee identity, such as a nickname.)
- Open text in pharma settings: is any filtering or moderation needed before responses appear on screen?
- Data retention: how long should past sessions be kept, given auto-delete is out of scope for v1?
- Commercial model: is this sold to clients, bundled with Wizzard work, or both? Does that affect billing or usage limits?
