import { expect, test } from '@playwright/test';
import {
  AT_HABITS,
  addHabit,
  button,
  field,
  habitRow,
  link,
  logIn,
  logOut,
  message,
  newAccount,
  signUp,
} from './helpers';

test.describe('settings', () => {
  test('a wrong current password is refused', async ({ page }) => {
    await signUp(page, newAccount());
    await page.goto('/settings');
    await field(page, 'Current password').fill('not-the-password');
    await field(page, 'New password').fill('a-brand-new-password');
    await button(page, 'Change password').click();
    await expect(message(page, 'Current password is incorrect')).toBeVisible();
  });

  test('a changed password is the one that logs in', async ({ page }) => {
    const account = newAccount();
    const changed = { ...account, password: 'a-brand-new-password' };
    await signUp(page, account);
    await page.goto('/settings');
    await field(page, 'Current password').fill(account.password);
    await field(page, 'New password').fill(changed.password);
    await button(page, 'Change password').click();
    await expect(message(page, 'Password updated')).toBeVisible();
    await logOut(page);
    await logIn(page, account);
    await expect(message(page, 'Invalid email or password')).toBeVisible();
    await logIn(page, changed);
    await expect(page).toHaveURL(AT_HABITS);
  });

  test('deleting the account needs a confirmation and removes it', async ({
    page,
  }) => {
    const account = newAccount();
    await signUp(page, account);
    await addHabit(page, 'Sketch');
    await page.goto('/settings');
    await button(page, 'Delete account').click();
    await button(page, 'Confirm delete account').click();
    await expect(page).toHaveURL(/\/$/);
    await logIn(page, account);
    await expect(message(page, 'Invalid email or password')).toBeVisible();
  });
});

test.describe('isolation', () => {
  test("one user never sees another user's habits", async ({
    page,
    browser,
  }) => {
    await signUp(page, newAccount());
    await addHabit(page, 'Private habit');
    await link(habitRow(page, 'Private habit'), 'Private habit').click();
    const habitUrl = page.url();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signUp(otherPage, newAccount());
    await expect(otherPage.getByTestId('habit-row')).toHaveCount(0);
    const response = await otherPage.goto(habitUrl);
    expect(response?.status()).toBe(404);
    await expect(message(otherPage, 'Habit not found')).toBeVisible();
    await other.close();
  });
});
