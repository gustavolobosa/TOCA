"use client";

import { useState } from "react";
import { destinationInput, destinationOptions } from "@/lib/destinations";
import type { DestinationType } from "@/lib/types";

export function DestinationFields({ type = "instagram", url = "" }: { type?: DestinationType; url?: string }) {
  const [selected, setSelected] = useState<DestinationType>(type);
  const option = destinationOptions.find(item => item.value === selected)!;
  return <>
    <label><span id="destination-type-label">Tipo de destino</span>
      <select aria-labelledby="destination-type-label" name="destination_type" value={selected} onChange={event => setSelected(event.target.value as DestinationType)}>
        {destinationOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
    <label><span id="destination-field-label">{option.field}</span>
      <input key={selected} name="destination" required maxLength={2048}
        type={selected === "generic" || selected === "google_review" ? "url" : selected === "whatsapp" ? "tel" : "text"}
        defaultValue={selected === type ? destinationInput(type, url) : ""} placeholder={option.placeholder}
        aria-labelledby="destination-field-label" aria-describedby="destination-hint" autoComplete="off" />
      <small id="destination-hint">{option.hint}</small>
    </label>
  </>;
}
