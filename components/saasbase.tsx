"use client";

/**
 * The SaaSBase widgets.
 *
 * Plain re-exports, and that is the point worth noting: they used to need
 * `dynamic(..., { ssr: false })` one by one, because importing
 * `@saasbase-io/elements/react` on a server threw `ReferenceError: HTMLElement
 * is not defined` — its component placeholders extended `HTMLElement` at module
 * scope, and Next renders client components on the server too, so `"use client"`
 * was no defence. That guard now lives in the package (>= 2.10.1) rather than in
 * every app that consumes it.
 *
 * The directive stays, because these are custom elements driven by browser APIs
 * and there is nothing for a server to do with them beyond rendering the
 * placeholder they hydrate into.
 */
export {
  Provider,
  Signin,
  Signup,
  SignedIn,
  SignedOut,
  NavUser,
  AccountSettings,
} from "@saasbase-io/elements/react";
