"use client";
import { useState } from "react";
import { Field } from "./ui";
export function RequestForm({
  kind = "ACCESS",
}: {
  kind?: "ACCESS" | "CONTACT";
}) {
  const [sent, setSent] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (sent)
    return (
      <div
        role="status"
        className="rounded-2xl border border-green-200 bg-green-50 p-6"
      >
        <h2 className="text-lg font-semibold text-green-900">
          {kind === "ACCESS" ? "School access requested" : "Message received"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-green-900">
          Your details have been saved for review.{" "}
          {kind === "ACCESS"
            ? "A request does not create a workspace or grant access. We will use the contact details you provided to arrange the next step."
            : "The service administrator can review your message."}
        </p>
      </div>
    );
  return (
    <form
      method="post"
      className="surface space-y-5 rounded-2xl p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        const form = new FormData(e.currentTarget);
        try {
          const response = await fetch("/api/school-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...Object.fromEntries(form), kind }),
          });
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error || "Unable to submit your request.");
          setSent(true);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Unable to submit your request.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="School or organisation">
        <input
          className="field"
          name="school_name"
          required
          minLength={2}
          maxLength={150}
          autoComplete="organization"
        />
      </Field>
      <Field label="Your name">
        <input
          className="field"
          name="contact_name"
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email">
          <input
            className="field"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone">
          <input
            className="field"
            name="phone"
            type="tel"
            maxLength={35}
            autoComplete="tel"
          />
        </Field>
      </div>
      <Field
        label={kind === "ACCESS" ? "Tell us about your school" : "Your message"}
      >
        <textarea
          className="field"
          name="message"
          rows={4}
          maxLength={2000}
          required={kind === "CONTACT"}
          placeholder={
            kind === "ACCESS"
              ? "Your role, school location, levels and approximate number of learners…"
              : "How can we help?"
          }
        />
      </Field>
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-3 text-xs leading-6 text-muted">
        <input className="mt-1.5" name="consent" type="checkbox" required />{" "}
        <span>
          I am authorised to submit these details and agree they may be used to
          respond to this request. Please do not include learner records or
          passwords.
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button className="btn-primary" disabled={busy}>
        {busy
          ? "Submitting…"
          : kind === "ACCESS"
            ? "Request school access"
            : "Send message"}
      </button>
    </form>
  );
}
