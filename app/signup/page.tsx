import { Signup } from "@/components/pontkit";

export default function SignUpPage() {
  return (
    <div className="pv-container pv-auth">
      <div className="pv-auth__head">
        <span className="pv-kicker">Same origin</span>
        <h1>Create your account</h1>
        <p>
          The cookies you get back are first-party, so the session is still here
          after a reload.
        </p>
      </div>

      <div className="pv-auth__widget">
        <Signup />
      </div>
    </div>
  );
}
