const developmentSecret = 'teamops-local-secret-change-me';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production' && (!secret || secret === developmentSecret)) {
    throw new Error('JWT_SECRET must be configured with a non-default value in production');
  }

  return secret ?? developmentSecret;
}

export function validateRuntimeConfig() {
  getJwtSecret();
}
