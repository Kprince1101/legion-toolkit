import { expect, test } from '@playwright/test';
import {
  AT_HABITS,
  addHabit,
  habitRow,
  historyDay,
  markDays,
  newAccount,
  openHabit,
  setDone,
  signUp,
  utcDay,
} from './helpers';

test.describe('habits', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, newAccount());
  });

  test('a new habit starts with no streak', async ({ page }) => {
    await addHabit(page, 'Read');
    const row = habitRow(page, 'Read');
    await expect(row.getByTestId('current-streak')).toHaveText(
      'Current streak: 0',
    );
    await expect(
      row.getByRole('button', { name: 'Mark done today' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('No habits yet')).toHaveCount(0);
  });

  test('an empty habit name is refused', async ({ page }) => {
    await page.goto('/habits');
    await page.getByRole('button', { name: 'Add habit' }).click();
    await expect(page.getByText('Habit name is required')).toBeVisible();
    await expect(page.getByTestId('habit-row')).toHaveCount(0);
  });

  test('habits are listed newest first', async ({ page }) => {
    await addHabit(page, 'Stretch');
    await addHabit(page, 'Journal');
    const rows = page.getByTestId('habit-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Journal');
    await expect(rows.nth(1)).toContainText('Stretch');
  });

  test('marking today done starts a streak and pressing again undoes it', async ({
    page,
  }) => {
    await addHabit(page, 'Walk');
    const row = habitRow(page, 'Walk');
    await row.getByRole('button', { name: 'Mark done today' }).click();
    const done = row.getByRole('button', { name: 'Done today', exact: true });
    await expect(done).toHaveAttribute('aria-pressed', 'true');
    await expect(row.getByTestId('current-streak')).toHaveText(
      'Current streak: 1',
    );
    await done.click();
    await expect(
      row.getByRole('button', { name: 'Mark done today' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(row.getByTestId('current-streak')).toHaveText(
      'Current streak: 0',
    );
  });

  test('the history grid covers the last 30 days ending today', async ({
    page,
  }) => {
    await addHabit(page, 'Water');
    await openHabit(page, 'Water');
    const days = page.getByTestId('history-day');
    await expect(days).toHaveCount(30);
    await expect(days.first()).toHaveAttribute('data-date', utcDay(29));
    await expect(days.last()).toHaveAttribute('data-date', utcDay(0));
  });

  test('backfilled days build current and longest streaks', async ({
    page,
  }) => {
    await addHabit(page, 'Run');
    await markDays(page, 'Run', [4, 3, 2, 1, 0]);
    await expect(page.getByTestId('current-streak')).toHaveText(
      'Current streak: 5',
    );
    await expect(page.getByTestId('longest-streak')).toHaveText(
      'Longest streak: 5',
    );
    await setDone(page, 2, false);
    await expect(page.getByTestId('current-streak')).toHaveText(
      'Current streak: 2',
    );
    await expect(page.getByTestId('longest-streak')).toHaveText(
      'Longest streak: 2',
    );
  });

  test('a streak survives until today is over', async ({ page }) => {
    await addHabit(page, 'Floss');
    await markDays(page, 'Floss', [2, 1]);
    await expect(historyDay(page, 0)).toHaveAttribute('data-done', 'false');
    await expect(page.getByTestId('current-streak')).toHaveText(
      'Current streak: 2',
    );
    await page.goto('/habits');
    await expect(
      habitRow(page, 'Floss').getByTestId('current-streak'),
    ).toHaveText('Current streak: 2');
  });

  test('a gap breaks the current streak but not the longest', async ({
    page,
  }) => {
    await addHabit(page, 'Meditate');
    await markDays(page, 'Meditate', [10, 9, 8, 0]);
    await expect(page.getByTestId('current-streak')).toHaveText(
      'Current streak: 1',
    );
    await expect(page.getByTestId('longest-streak')).toHaveText(
      'Longest streak: 3',
    );
  });

  test('a habit can be renamed', async ({ page }) => {
    await addHabit(page, 'Pushups');
    await openHabit(page, 'Pushups');
    await page.getByLabel('Habit name').fill('Pullups');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Pullups' }),
    ).toBeVisible();
    await page.goto('/habits');
    await expect(habitRow(page, 'Pullups')).toHaveCount(1);
    await expect(habitRow(page, 'Pushups')).toHaveCount(0);
  });

  test('deleting a habit needs a confirmation', async ({ page }) => {
    await addHabit(page, 'Guitar');
    await openHabit(page, 'Guitar');
    await page.getByRole('button', { name: 'Delete habit' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(AT_HABITS);
    await expect(habitRow(page, 'Guitar')).toHaveCount(0);
  });

  test('a habit that does not exist is a 404', async ({ page }) => {
    const response = await page.goto('/habits/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Habit not found')).toBeVisible();
  });
});
