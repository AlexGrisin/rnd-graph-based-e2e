export type AppProductConfig = {
  /** Path relative to BASE_URL (e.g. `/shop/men/jeans/...`). */
  productPath: string;
};

const DEFAULT_PRODUCT_PATH = '/shop/men/jeans/d28534-e205-h918';

export function getAppProduct(): AppProductConfig {
  const productPath = process.env.PRODUCT_PATH?.trim() || DEFAULT_PRODUCT_PATH;
  return { productPath };
}
