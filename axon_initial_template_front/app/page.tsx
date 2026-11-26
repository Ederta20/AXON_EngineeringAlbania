"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAxon } from "@/lib/store";
import { homeFor } from "@/components/Shell";

export default function Index() {
  const { user, ready } = useAxon();
  const router = useRouter();
  useEffect(() => { if (ready) router.replace(user ? homeFor(user.role) : "/login"); }, [ready, user, router]);
  return null;
}
