"use client";

import { useState } from "react";
import { IconCheck } from "@/components/ui/icons";

interface InvitationAcceptCardProps {
  token: string;
  isSignedIn: boolean;
  invitedEmail: string;
}

export default function InvitationAcceptCard({
  token,
  isSignedIn,
  invitedEmail,
}: InvitationAcceptCardProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function acceptInvite() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/workspace/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = await response.json();
    if (payload.success) {
      window.location.assign("/dashboard");
      return;
    }
    setMessage(payload.error ?? "Не удалось принять приглашение");
    setBusy(false);
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-3">
        <a href="/login" className="btn btn-primary btn-lg w-full">
          Войти, чтобы принять
        </a>
        <p className="hint text-center">
          Войдите по ссылке из письма на адрес {invitedEmail}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={acceptInvite}
        disabled={busy}
        className="btn btn-primary btn-lg w-full"
      >
        <IconCheck size={18} />
        {busy ? "Принимаем…" : "Принять приглашение"}
      </button>
      {message && (
        <p className="text-center text-[13px] text-error" role="alert">
          {message}
        </p>
      )}
      <p className="hint text-center">
        Войдите по ссылке из письма на адрес {invitedEmail}.
      </p>
    </div>
  );
}
