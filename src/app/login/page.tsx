"use client";

import Link from "next/link";
import AuthForm from "@/frontend/components/AuthForm";
import { createClient } from "@/frontend/supabase";

export default function LoginPage() {
  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      pendingLabel="Logging in..."
      onSubmit={async (email, password) => {
        const { error } = await createClient().auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      }}
      footer={
        <>
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </>
      }
    />
  );
}
