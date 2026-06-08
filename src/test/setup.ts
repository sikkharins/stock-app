// Vitest global setup. Loaded once before any test file runs (see vite.config.js → test.setupFiles).
// Imports jest-dom's custom matchers (toBeInTheDocument, toHaveTextContent, etc.)
// onto vitest's expect, so they're available in all *.test.tsx files without re-importing.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library unmounts everything between tests so DOM state doesn't bleed across tests.
afterEach(() => {
  cleanup();
});
