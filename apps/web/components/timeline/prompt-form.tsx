"use client";

import { useMemo, useState } from "react";
import { coerceString } from "./utils";

export function PromptForm({
  fields,
  onSubmit,
  promptId,
  submitLabel,
  title,
}: {
  fields: Array<Record<string, unknown>>;
  onSubmit: (promptId: string, answers: Record<string, string>) => Promise<void>;
  promptId: string;
  submitLabel: string;
  title: string;
}) {
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        fields.map((field) => [coerceString(field.id), ""]),
      ),
    [fields],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void onSubmit(promptId, values).finally(() => setPending(false));
      }}
    >
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The workflow needs narrative context before it can generate the report.
        </p>
      </div>
      {fields.map((field) => {
        const id = coerceString(field.id);
        const fieldType = coerceString(field.type) || "textarea";
        const options = Array.isArray(field.options)
          ? (field.options as Array<Record<string, unknown>>)
          : [];
        return (
          <div key={id} className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              {coerceString(field.label)}
            </span>
            {fieldType === "select" ? (
              <select
                value={values[id] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [id]: event.target.value,
                  }))
                }
                className="w-full border border-border/60 bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-border"
              >
                <option value="" disabled>
                  {coerceString(field.placeholder) || "Select…"}
                </option>
                {options.map((opt) => (
                  <option key={coerceString(opt.value)} value={coerceString(opt.value)}>
                    {coerceString(opt.label)}
                  </option>
                ))}
              </select>
            ) : fieldType === "checkboxes" ? (
              <div className="grid grid-cols-2 gap-1.5">
                {options.map((opt) => {
                  const val = coerceString(opt.value);
                  const checked = (values[id] ?? "").split(",").filter(Boolean).includes(val);
                  return (
                    <label
                      key={val}
                      className="flex cursor-pointer items-center gap-2 border border-border/40 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent/40 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setValues((current) => {
                            const prev = (current[id] ?? "").split(",").filter(Boolean);
                            const next = checked ? prev.filter((v) => v !== val) : [...prev, val];
                            return { ...current, [id]: next.join(",") };
                          });
                        }}
                        className="accent-primary size-3 shrink-0"
                      />
                      {coerceString(opt.label)}
                    </label>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={values[id] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [id]: event.target.value,
                  }))
                }
                placeholder={coerceString(field.placeholder)}
                rows={3}
                className="w-full resize-y border border-border/60 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-border"
              />
            )}
          </div>
        );
      })}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center border border-border/70 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60"
      >
        {pending ? "Submitting" : submitLabel}
      </button>
    </form>
  );
}
