import { expect, type Locator, type Page } from '@playwright/test';
import { dismissAppOverlays } from '../app/overlays.js';

/**
 * One page object for every /stores situation that shows the search form:
 * bare locator, validation error, results, no results, and a map-selected store.
 */
export class StoreLocatorPage {
  private readonly searchInput: Locator;
  private readonly brandSelect: Locator;
  private readonly findStoresButton: Locator;
  private readonly searchAgainButton: Locator;
  private readonly validationAlert: Locator;
  private readonly resultsSummary: Locator;
  private readonly noResultsSummary: Locator;
  private readonly showAllResultsButton: Locator;
  private readonly storeDetailsLink: Locator;
  private readonly regionHeading: Locator;
  private readonly regionLondonLink: Locator;
  private readonly mapMarker: Locator;

  constructor(private readonly page: Page) {
    const main = page.locator('main');
    this.searchInput = page.getByTestId('storeLookup');
    this.brandSelect = page.locator('#storeLookupBrand');
    this.findStoresButton = page.getByTestId('find-stores-button');
    this.searchAgainButton = page.getByTestId('search-again-button');
    this.validationAlert = main.getByRole('alert').filter({
      hasText: 'Please enter a valid postcode, town or city',
    });
    this.resultsSummary = main.getByText(/^\d+ Results? for /);
    this.noResultsSummary = main.getByText(/^No Results for /);
    this.showAllResultsButton = main.getByRole('button', {
      name: 'Show all results',
    });
    this.storeDetailsLink = main
      .getByRole('link', { name: 'View Full Store Details' })
      .first();
    this.regionHeading = main.getByRole('heading', {
      name: 'Browse All Stores',
    });
    this.regionLondonLink = main.getByRole('link', {
      name: 'London',
      exact: true,
    });
    // First city marker on the store map — selecting it reveals that store's card.
    this.mapMarker = main.getByRole('button', { name: 'Aberdeen' });
  }

  /** Bare store locator: search form plus region browsing, no query. */
  async shouldBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/stores$/);
    await expect(this.searchInput).toBeVisible();
    await expect(this.brandSelect).toBeVisible();
    await expect(this.findStoresButton).toBeVisible();
    await expect(this.regionHeading).toBeVisible();
  }

  async shouldShowValidationError(): Promise<void> {
    await expect(this.page).toHaveURL(/\/stores$/);
    await expect(this.validationAlert).toBeVisible();
    await expect(this.resultsSummary).toHaveCount(0);
  }

  async shouldShowResults(): Promise<void> {
    await expect(this.page).toHaveURL(/\/stores\?q=/);
    await expect(this.resultsSummary).toBeVisible();
    await expect(this.storeDetailsLink).toBeVisible();
  }

  async shouldShowNoResults(): Promise<void> {
    await expect(this.page).toHaveURL(/\/stores\?q=/);
    await expect(this.noResultsSummary).toBeVisible();
    await expect(this.storeDetailsLink).toHaveCount(0);
  }

  async shouldShowMapSelection(): Promise<void> {
    await expect(this.page).toHaveURL(/\/stores$/);
    await expect(this.storeDetailsLink).toBeVisible();
    await expect(this.resultsSummary).toHaveCount(0);
  }

  /** Submits the search form with an empty postcode/city field. */
  async submitEmpty(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.searchInput.fill('');
    await this.findStoresButton.click();
    await this.validationAlert.waitFor();
  }

  /** Searches by postcode/city, optionally narrowed to a brand; works from any state showing the form. */
  async search(query: string, brand?: string): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.searchInput.fill(query);
    await this.brandSelect.selectOption(
      brand ? { label: brand } : { index: 0 },
    );
    await this.findStoresButton.or(this.searchAgainButton).click();
    await this.page.waitForURL(/\/stores\?q=/, { timeout: 30_000 });
  }

  async showAllResults(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.showAllResultsButton.click();
    await expect(this.showAllResultsButton).toHaveCount(0);
  }

  async browseRegion(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.regionLondonLink.click();
    await this.page.waitForURL(/\/stores\/region\//, { timeout: 30_000 });
  }

  async selectStoreOnMap(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.mapMarker.click();
    await this.storeDetailsLink.waitFor();
  }

  /** Opens the first store card's full details — deterministic, so generated test names stay stable. */
  async openStoreDetails(): Promise<void> {
    await dismissAppOverlays(this.page);
    await this.storeDetailsLink.click();
    await this.page.waitForURL(/\/stores\/(?!region\/)[^/?]+$/, {
      timeout: 30_000,
    });
  }
}
