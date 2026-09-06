import { Signin } from "@/components/pontkit";

export default function SignInPage() {
  return (
    <div className="pv-container pv-auth">
      <div className="pv-auth__head">
        <span className="pv-kicker">Same origin</span>
        <h1>Welcome back</h1>
        <p>
          This form talks to <code className="pv-code">/__auth</code> on this
          origin. Nothing crosses to another host.
        </p>
      </div>

      <div className="pv-auth__widget">
        <Signin />
      </div>
    </div>
  );
}
