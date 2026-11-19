# Habit tracker

Build this app in this repo. It is a Next.js App Router app in TypeScript,
already scaffolded. The Playwright checks in `acceptance/` define done, and
they depend on the routes, labels, button names and `data-testid` values
below, so use them exactly as written.

## Ground rules

- Everything runs from `npm install`, `npx next build` and `npx next start`.
  No hosted database, no third-party auth provider, nothing else running.
- Store data on the server: a SQLite file, a JSON file under `data/`, or
  memory. Data has to survive for as long as the server process runs.
- Never store a password in plain text. Hash it, for example with
  `node:crypto` scrypt.
- A session is an HTTP-only cookie. `Log out` clears it and lands on `/`.
- Dates are UTC calendar days in `YYYY-MM-DD` form. "Today" is the server's
  current UTC date.
- Every signed-in page shows a header with links `Habits`, `Stats` and
  `Settings`, and a `Log out` button.
- A signed-out visit to `/habits`, `/habits/<id>`, `/stats` or `/settings`
  redirects to `/login`.

## Screens

### `/` Landing

- Signed out: a heading `Habit tracker`, a `Sign up` link to `/signup` and a
  `Log in` link to `/login`.
- Signed in: redirects to `/habits`.

### `/signup`

- Fields labelled `Email` and `Password`, and a `Create account` button.
- Success signs the user in and lands on `/habits`.
- An email that already has an account shows
  `An account with that email already exists`.
- A password shorter than 8 characters shows
  `Password must be at least 8 characters`.

### `/login`

- Fields labelled `Email` and `Password`, and a `Log in` button.
- Success lands on `/habits`.
- A wrong email or password shows `Invalid email or password`.

### `/habits`

- A level-one heading `Habits`.
- A field labelled `Habit name` and an `Add habit` button. An empty name
  shows `Habit name is required`.
- One row per habit, `data-testid="habit-row"`, newest first, containing:
  - a link with the habit's name, to `/habits/<id>`;
  - `data-testid="current-streak"` with the text `Current streak: N`;
  - a toggle button for today. Not done: named `Mark done today`,
    `aria-pressed="false"`. Done: named `Done today`, `aria-pressed="true"`.
    Pressing it flips today's completion.
- No habits yet: the text `No habits yet`.

### `/habits/<id>`

- A level-one heading with the habit's name.
- `data-testid="current-streak"` with `Current streak: N` and
  `data-testid="longest-streak"` with `Longest streak: N`.
- A history grid of the last 30 days, oldest first, ending with today. Each
  day is a button with `data-testid="history-day"`,
  `data-date="YYYY-MM-DD"` and `data-done="true"` or `"false"`. Pressing a
  day flips that day's completion, so past days can be backfilled, including
  days before the habit was created.
- A field labelled `Habit name` holding the current name and a `Save`
  button that renames the habit.
- A `Delete habit` button. Pressing it shows a `Confirm delete` button;
  pressing that deletes the habit and its history and returns to `/habits`.
- A habit that does not exist, or belongs to another user, shows
  `Habit not found` with HTTP status 404.

### `/stats`

- A level-one heading `Stats`.
- `data-testid="stat-total-habits"`: the number of habits.
- `data-testid="stat-week-completions"`: completions over the last 7 days,
  today included, across all habits.
- `data-testid="stat-month-rate"`: completed habit-days over the last 30 days
  divided by (number of habits × 30), as a whole percentage rounded to the
  nearest integer, for example `7%`. `0%` with no habits.
- `data-testid="stat-best-current-streak"`: the habit with the highest
  current streak and its count, for example `Read — 3`. `None` with no
  habits.
- `data-testid="stat-longest-streak"`: the longest streak any habit has ever
  had, as a number.
- A heatmap of the last 30 days, oldest first: one element per day with
  `data-testid="heatmap-day"`, `data-date` and `data-count` set to the number
  of habits completed that day. The heatmap is not a `<table>`.
- A table, the only one on the page, with column headers `Habit`,
  `Current streak`, `Longest streak` and `30-day rate`, one row per habit.
  Each numeric header is a button. Pressing it sorts by that column, highest
  first; pressing it again sorts lowest first.

### `/settings`

- Fields labelled `Current password` and `New password`, and a
  `Change password` button. A wrong current password shows
  `Current password is incorrect`. Success shows `Password updated`.
- A `Delete account` button. Pressing it shows a `Confirm delete account`
  button; pressing that deletes the user, their habits and history, signs
  out and lands on `/`.

## Streaks

- Current streak: the number of consecutive completed days ending today. If
  today is not completed yet, the run ending yesterday still counts, so a
  streak does not break until the day is over.
- Longest streak: the longest run of consecutive completed days the habit
  has ever had.
- A user only ever sees and changes their own habits.
