export function SiteFooter() {
  return (
    <footer className="pv-footer">
      <div className="pv-container pv-footer__inner">
        <span>
          Auth served from <code className="pv-code">/__auth</code> on this
          origin
        </span>
        <span className="pv-footer__spacer" />
        <a href="https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites">
          Next.js rewrites
        </a>
        <a href="https://vercel.com/docs/projects/project-configuration">
          Vercel config
        </a>
      </div>
    </footer>
  );
}
