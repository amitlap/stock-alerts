"use client";

import Link from "next/link";
import AuthForm from "@/frontend/components/AuthForm";
import { createClient } from "@/frontend/supabase";

export default function SignupPage() {
  return (
    <AuthForm
      title="Sign up"
      submitLabel="Sign up"
      pendingLabel="Signing up..."
      minPasswordLength={6}
      passwordHelp="At least 6 characters"
      onSubmit={async (email, password) => {
        const { data, error } = await createClient().auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        // With email confirmation on, there's no session until the user confirms.
        if (!data.session) return "Check your email to confirm your account before logging in.";
      }}
      footer={
        <>
          Already have an account? <Link href="/login">Log in</Link>
        </>
      }
    />
  );
}
