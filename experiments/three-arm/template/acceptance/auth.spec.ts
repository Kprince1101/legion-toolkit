import { expect, test } from '@playwright/test';
import {
  AT_HABITS,
  AT_LOGIN,
  button,
  field,
  heading,
  link,
  logIn,
  logOut,
  message,
  newAccount,
  signUp,
} from './helpers';

test.describe('auth', () => {
  test('the landing page offers sign up and log in', async ({ page }) => {
    await page.goto('/');
    await expect(heading(page, 'Habit tracker').first()).toBeVisible();
    await expect(link(page, 'Sign up')).toHaveAttribute('href', '/signup');
    await expect(link(page, 'Log in')).toHaveAttribute('href', '/login');
  });

  test('signing up lands on the habits page', async ({ page }) => {
    await signUp(page, newAccount());
    await expect(heading(page, 'Habits')).toBeVisible();
    await expect(message(page, 'No habits yet')).toBeVisible();
  });

  test('a second account with the same email is refused', async ({ page }) => {
    const account = newAccount();
    await signUp(page, account);
    await logOut(page);
    await page.goto('/signup');
    await field(page, 'Email').fill(account.email);
    await field(page, 'Password').fill(account.password);
    await button(page, 'Create account').click();
    await expect(
      message(page, 'An account with that email already exists'),
    ).toBeVisible();
  });

  test('a short password is refused', async ({ page }) => {
    await page.goto('/signup');
    await field(page, 'Email').fill(newAccount().email);
    await field(page, 'Password').fill('short');
    await button(page, 'Create account').click();
    await expect(
      message(page, 'Password must be at least 8 characters'),
    ).toBeVisible();
  });

  test('a wrong password is refused and the right one logs in', async ({
    page,
  }) => {
    const account = newAccount();
    await signUp(page, account);
    await logOut(page);
    await logIn(page, { ...account, password: 'not-the-password' });
    await expect(message(page, 'Invalid email or password')).toBeVisible();
    await logIn(page, account);
    await expect(page).toHaveURL(AT_HABITS);
  });

  test('a signed-in visit to the landing page goes to habits', async ({
    page,
  }) => {
    await signUp(page, newAccount());
    await page.goto('/');
    await expect(page).toHaveURL(AT_HABITS);
  });

  test('signed-out visits to private pages redirect to login', async ({
    page,
  }) => {
    for (const path of ['/habits', '/habits/1', '/stats', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(AT_LOGIN);
    }
  });

  test('logging out ends the session', async ({ page }) => {
    await signUp(page, newAccount());
    await logOut(page);
    await page.goto('/habits');
    await expect(page).toHaveURL(AT_LOGIN);
  });

  test('the header links to every signed-in page', async ({ page }) => {
    await signUp(page, newAccount());
    await link(page, 'Stats').click();
    await expect(page).toHaveURL(/\/stats$/);
    await link(page, 'Settings').click();
    await expect(page).toHaveURL(/\/settings$/);
    await link(page, 'Habits').click();
    await expect(page).toHaveURL(AT_HABITS);
  });
});
