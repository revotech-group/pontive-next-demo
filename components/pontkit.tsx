"use client";

/**
 * The PontKit widgets.
 *
 * Plain re-exports, and that is the point worth noting: they used to need
 * `dynamic(..., { ssr: false })` one by one, because importing the React
 * bindings on a server threw `ReferenceError: HTMLElement is not defined` — a
 * file of component placeholders extended `HTMLElement` at module scope, and
 * Next renders client components on the server too, so `"use client"` was no
 * defence. Those placeholders are gone entirely now: the bindings take the
 * element types from @pontive/pontkit-core with `import type`, which erases.
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
} from "@pontive/pontkit-nextjs";
