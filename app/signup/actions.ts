"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) redirect("/signup?error=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) redirect("/signup?error=failed");
  if (!data.user) redirect("/signup?error=failed");

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    display_name: displayName,
  });

  if (profileError) redirect("/signup?error=profile");

  const { error: settingsError } = await supabase.from("user_settings").upsert({
    user_id: data.user.id,
  });

  if (settingsError) redirect("/signup?error=settings");

  if (data.session) redirect("/dashboard");
  redirect("/login?created=1");
}
