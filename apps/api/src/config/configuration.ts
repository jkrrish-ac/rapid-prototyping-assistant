export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  },
  mongoUri:
    process.env.MONGODB_URI ??
    'mongodb://localhost:27017/rapid_prototype_assistant',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      callbackUrl: process.env.GITHUB_CALLBACK_URL ?? '',
    },
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    modelOpus: process.env.ANTHROPIC_MODEL_OPUS ?? 'claude-opus-4-6',
    modelSonnet: process.env.ANTHROPIC_MODEL_SONNET ?? 'claude-sonnet-4-6',
    // Optional: forces every stage's max_tokens to this value, overriding
    // each stage's own budget in stage-definitions.ts. Useful either to
    // raise every stage at once, or to cap them all down if your account's
    // model rejects the larger per-stage defaults (BUILD/FIX in particular)
    // with an "invalid_request_error: max_tokens too large" response.
    maxTokensOverride: process.env.ANTHROPIC_MAX_TOKENS
      ? parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10)
      : undefined,
  },
});
