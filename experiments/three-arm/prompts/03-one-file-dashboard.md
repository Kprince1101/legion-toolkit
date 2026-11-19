Turn the stats page into a full dashboard. Keep everything SPEC.md asks for,
and add:

- a bar chart of completions per week for the last 12 weeks, in plain SVG,
  no chart library;
- a "best day of the week" card showing which weekday has the most
  completions;
- a filter to show one habit or all of them, which every number, the
  heatmap, the chart and the table respect;
- a streak leaderboard of the top 5 habits by longest streak, with a small
  progress bar each.

I want to review the whole dashboard in one place, so put all of it in a
single file, `app/stats/StatsDashboard.tsx`: no new hooks, helper files or
child component files for this. The acceptance checks still have to pass.
