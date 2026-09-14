export type AppProductConfig = {
  /** Path relative to BASE_URL. */
  productPath: string;
};

export function getAppProduct(): AppProductConfig {
  const productPath = process.env.PRODUCT_PATH?.trim();

  if (!productPath) {
    throw new Error(
      'Missing PRODUCT_PATH. Set it in .env (see .env.example) before running the live shopping flow.',
    );
  }

  return { productPath };
}
