/**
 * Applies the stored theme before first paint.
 *
 * `data-theme` on <html> is the widgets' switch as much as ours — core-elements
 * reads it, and the project's `branding.css` defines a full brand palette under
 * both `[data-theme="light"]` and `[data-theme="dark"]`. Setting it here rather
 * than in an effect avoids a flash of the wrong theme on every navigation.
 *
 * It also has to run *before* the SDK: `initTheme()` in core-elements writes
 * `light` only when the attribute is missing or unrecognised, so a value already
 * in place is left alone. Setting it later would be a fight over the same
 * attribute.
 */
export function ThemeScript() {
  const script = `
    try {
      var stored = localStorage.getItem("pv-theme");
      var theme = stored === "light" || stored === "dark"
        ? stored
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", theme);
    } catch (e) {
      document.documentElement.setAttribute("data-theme", "light");
    }
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
