## Packages
recharts | Dashboard analytics charts and data visualization
date-fns | Human-readable date formatting
jwt-decode | Safely decoding JWT tokens to check expiration
lucide-react | Icons for the UI

## Notes
- PWA setup requires a `manifest.json` and a Service Worker (`sw.js`) in the `public` directory.
- Authentication uses JWT stored in localStorage. `queryClient.ts` has been modified to inject the `Authorization: Bearer <token>` header automatically into all TanStack Query requests.
- PDF Export endpoint requires the JWT token, so it's downloaded via `fetch` as a Blob rather than a simple `window.open` to ensure the Authorization header is passed.
- The UI follows a striking, deep dark-mode-first aesthetic (Stripe-inspired) with vibrant purple/blue accents.
