// Stripe publishable key — reads from env var with hardcoded fallback
export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  "pk_test_51SyDFJCn71ikcRod3ASeaRYct3zYcpRSeXwMWAPzwABJY5L0dAX2WUV0Q660EoZyqVicQCP3KHdDyMrDwYynyHxA00Ye97jQFM";
