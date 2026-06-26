Reusable page object pattern for Playwright MBT adapters in this workspace.

## Name

MBT Page Object

## Description

Encapsulates browser interactions and state assertions for one application screen. Page objects sit in `tests/support/pages/` and are exposed as Playwright fixtures — never imported from `src/`.

Use when:

- Adding a new machine state that maps to a real browser screen
- Implementing transition actions (e.g. `GO_LOGIN`, `SUBMIT`) as page methods
- Asserting the browser is on the expected state after each graph step

Do **not** put locators or Playwright calls in `src/` — that breaks model/engine separation.

## Conventions

| Rule                                            | Rationale                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Class name: `<PageName>Page`                    | e.g. `HomePage`, `LoginPage`, `CartPage`                                             |
| `constructor(page: Page)`                       | Accept Playwright `page`; define **all** selectors as private `readonly` fields here |
| Selectors live in the page object               | No shared `locators.ts` — each POM owns its elements                                 |
| Assertion methods start with `should`           | e.g. `shouldBeOnPage()`, `shouldShowError()` — used by state verifier                |
| Action methods mirror user intents              | Action map delegates `EVENT` → fixture page method                                   |
| Expose as Playwright fixtures                   | One fixture per page object in `tests/fixtures.ts` — no `PageRegistry`               |
| Call `dismissAppOverlays()` before interactions | Site overlays block clicks on live runs                                              |
| Use `.js` extension in imports                  | ESM + `NodeNext` module resolution                                                   |

## Template

```typescript
// tests/support/pages/login.page.ts
import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

export class LoginPage {
  private readonly emailField: Locator;
  private readonly passwordField: Locator;
  private readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.emailField = page.getByRole('textbox', { name: /Email/i });
    this.passwordField = page.getByRole('textbox', { name: /Password/i });
    this.loginButton = page.getByRole('button', { name: 'log in' });
  }

  /** Assert browser matches this machine state — used by state verifier. */
  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/account\/create/);
  }

  /** Variant for terminal/error states on the same screen. */
  async shouldShowError(): Promise<void> {
    await expect(this.page).toHaveURL(/\/account\/create\?error=true/);
  }

  /** User intent invoked by an action-map handler. */
  async submit(username: string, password: string): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.emailField.fill(username);
    await this.passwordField.fill(password);
    await this.loginButton.click();
    await this.page.waitForURL((url) => /\/account$/.test(url.pathname), {
      timeout: 30_000,
    });
  }
}
```

## Playwright fixture extension

Register each page object as its own fixture in `tests/fixtures.ts`:

```typescript
// tests/fixtures.ts
import { HomePage } from './support/pages/home.page.js';
import { LoginPage } from './support/pages/login.page.js';
import { CartPage } from './support/pages/cart.page.js';

type PageFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  cartPage: CartPage;
};

export const test = base.extend<PageFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  // ... other MBT fixtures (actions, stateVerifier, mbtContext)
});
```

When adding a new page object:

1. Create `tests/support/pages/<page-name>.page.ts` with class `<PageName>Page`.
2. Add a matching fixture (`cartPage: CartPage`) in `tests/fixtures.ts`.
3. Wire the fixture into `actions` and `stateVerifier` factories (see below).

## State verifier registration

Map machine state ids to `should*` methods. Receive page fixtures — not a registry:

```typescript
// tests/support/pages/state-verifier.ts
import type { HomePage } from './home.page.js';
import type { LoginPage } from './login.page.js';
import type { CartPage } from './cart.page.js';

type PageFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  cartPage: CartPage;
};

export function createStateVerifier(pages: PageFixtures): StateVerifier {
  const assertions: Record<string, () => Promise<void>> = {
    home: () => pages.homePage.shouldBeOnPage(),
    login: () => pages.loginPage.shouldBeOnPage(),
    cart: () => pages.cartPage.shouldBeOnPage(),
    error: () => pages.loginPage.shouldShowError(),
  };

  return async (expectedState) => {
    const assert = assertions[expectedState];
    if (!assert) {
      throw new Error(
        `No page assertion for state "${expectedState}" — add a page object fixture and register it in state-verifier.ts`,
      );
    }
    await assert();
  };
}
```

Fixture wiring:

```typescript
stateVerifier: async ({ homePage, loginPage, cartPage }, use, testInfo) => {
  if (testInfo.project.name === 'stub') {
    await use(noopStateVerifier);
    return;
  }
  await use(createStateVerifier({ homePage, loginPage, cartPage }));
},
```

## Action map wiring

Action factories receive page fixtures directly:

```typescript
// tests/support/actions/app-auth.actions.ts
type PageFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  cartPage: CartPage;
};

export function createAppAuthActions(pages: PageFixtures): ActionMap {
  return {
    GO_LOGIN: async (ctx) => {
      ctx.log('GO_LOGIN');
      await pages.homePage.openLogin();
    },
    SUBMIT: async (ctx) => {
      ctx.log('SUBMIT');
      await pages.loginPage.submit(email, password);
    },
  };
}
```

Fixture wiring:

```typescript
actions: async ({ homePage, loginPage, cartPage }, use, testInfo) => {
  if (testInfo.project.name === 'stub') {
    await use(createStubActions());
    return;
  }
  await use(createAppAuthActions({ homePage, loginPage, cartPage }));
},
```

## Naming reference

| Screen     | Class           | Fixture         |
| ---------- | --------------- | --------------- |
| Home       | `HomePage`      | `homePage`      |
| Login      | `LoginPage`     | `loginPage`     |
| Cart       | `CartPage`      | `cartPage`      |
| My Account | `MyAccountPage` | `myAccountPage` |

## Reference implementations

- `tests/support/pages/home.page.ts` — navigation + conditional flow
- `tests/support/pages/login.page.ts` — form interaction + error variant
- `tests/support/pages/my-account.page.ts` — post-login state + logout
- `tests/fixtures.ts` — `homePage`, `loginPage`, `myAccountPage` fixtures
