import { expect, test } from '@playwright/test';
import {
  AT_HABITS,
  AT_LOGIN,
  logIn,
  logOut,
  newAccount,
  signUp,
} from './helpers';

test.describe('auth', () => {
  test('the landing page offers sign up and log in', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Habit tracker' }),
    ).toBeVisible();
    const signUpLink = page.getByRole('link', { name: 'Sign up' });
    await expect(signUpLink).toHaveAttribute('href', '/signup');
    const logInLink = page.getByRole('link', { name: 'Log in' });
    await expect(logInLink).toHaveAttribute('href', '/login');
  });

  test('signing up lands on the habits page', async ({ page }) => {
    await signUp(page, newAccount());
    await expect(
      page.getByRole('heading', { level: 1, name: 'Habits' }),
    ).toBeVisible();
    await expect(page.getByText('No habits yet')).toBeVisible();
  });

  test('a second account with the same email is refused', async ({ page }) => {
    const account = newAccount();
    await signUp(page, account);
    await logOut(page);
    await page.goto('/signup');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(
      page.getByText('An account with that email already exists'),
    ).toBeVisible();
  });

  test('a short password is refused', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(newAccount().email);
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(
      page.getByText('Password must be at least 8 characters'),
    ).toBeVisible();
  });

  test('a wrong password is refused and the right one logs in', async ({
    page,
  }) => {
    const account = newAccount();
    await signUp(page, account);
    await logOut(page);
    await logIn(page, { ...account, password: 'not-the-password' });
    await expect(page.getByText('Invalid email or password')).toBeVisible();
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
    await page.getByRole('link', { name: 'Stats', exact: true }).click();
    await expect(page).toHaveURL(/\/stats$/);
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole('link', { name: 'Habits', exact: true }).click();
    await expect(page).toHaveURL(AT_HABITS);
  });
});
