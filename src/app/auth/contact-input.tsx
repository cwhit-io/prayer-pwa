"use client";

import { useState } from "react";

export function ContactInput() {
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const isEmail = contactType === "email";

  return (
    <fieldset className="space-y-4">
      <legend className="plc-label">Send my code by</legend>
      <div className="mt-2 flex flex-wrap gap-3">
        <label className="plc-card-muted flex cursor-pointer items-center gap-2 px-4 py-3 font-black text-white">
          <input
            type="radio"
            name="contact_type"
            value="email"
            checked={isEmail}
            onChange={() => setContactType("email")}
            className="plc-checkbox"
          />
          Email
        </label>
        <label className="plc-card-muted flex cursor-pointer items-center gap-2 px-4 py-3 font-black text-white">
          <input
            type="radio"
            name="contact_type"
            value="phone"
            checked={!isEmail}
            onChange={() => setContactType("phone")}
            className="plc-checkbox"
          />
          Mobile phone
        </label>
      </div>
      <label className="block space-y-2">
        <span className="plc-label">{isEmail ? "Email address" : "Mobile phone number"}</span>
        <input
          required
          key={contactType}
          name="contact"
          type={isEmail ? "email" : "tel"}
          inputMode={isEmail ? "email" : "tel"}
          autoComplete={isEmail ? "email" : "tel"}
          className="plc-input w-full px-4 py-3"
          placeholder={isEmail ? "you@example.com" : "260-555-1212"}
        />
      </label>
    </fieldset>
  );
}
