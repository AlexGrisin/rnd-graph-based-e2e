export type AppCredentials = {
  email: string;
  password: string;
};

export function getAppCredentials(): AppCredentials {
  const email = process.env.APP_EMAIL ?? '';
  const password = process.env.APP_PASSWORD ?? '';

  if (!email || !password) {
    throw new Error(
      'Missing APP_EMAIL or APP_PASSWORD. Set them in .env (see .env.example).',
    );
  }

  return { email, password };
}
