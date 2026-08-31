import Link from "next/link";
import { SignedIn, SignedOut, NavUser } from "@/components/saasbase";

export default function ProfilePage() {
  return (
    <main>
      <h1>Profile</h1>
      <SignedIn>
        <NavUser accountSettingsPath="/profile" />
      </SignedIn>
      <SignedOut>
        <p>
          Nothing to show — <Link href="/signin">sign in</Link> first.
        </p>
      </SignedOut>
    </main>
  );
}
