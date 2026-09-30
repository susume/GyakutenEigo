import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Gamepad2, Mic } from "lucide-react";

type ClassroomProduct = "speaking" | "quiz";

export default function ClassroomCodeEntry({ onJoin }: { onJoin: (product: ClassroomProduct, code: string) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [product, setProduct] = useState<ClassroomProduct>("speaking");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter all 6 letters or numbers from your teacher’s code.");
      input.current?.focus();
      return;
    }
    onJoin(product, code);
  };

  return <section className="hub-classroom-entry" aria-labelledby={`${id}-title`}>
    <div className="hub-classroom-entry-copy">
      <span className="product-hub-card-label">For students</span>
      <h2 id={`${id}-title`}>Have a classroom code?</h2>
      <p>Choose your app and join. No student account needed.</p>
    </div>
    <form className="hub-classroom-entry-form" onSubmit={submit} noValidate>
      <fieldset className="hub-product-choice">
        <legend>Choose your classroom app</legend>
        {(["speaking", "quiz"] as const).map((value) => {
          const Icon = value === "speaking" ? Mic : Gamepad2;
          return <label key={value}>
            <input type="radio" name={`${id}-product`} value={value} checked={product === value} onChange={() => setProduct(value)} />
            <span><Icon size={17} aria-hidden="true" />{value === "speaking" ? "SpeakCheck" : "QuizStrike"}</span>
          </label>;
        })}
      </fieldset>
      <div className="hub-code-row">
        <label htmlFor={`${id}-code`}>
          Classroom code
          <input ref={input} id={`${id}-code`} value={code} placeholder="ABC123" maxLength={6}
            onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setError(""); }}
            autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go"
            aria-invalid={Boolean(error)} aria-describedby={`${id}-help`} />
        </label>
        <button className="hub-code-submit" type="submit">Join class <ArrowRight size={18} aria-hidden="true" /></button>
      </div>
      <p id={`${id}-help`} className={error ? "hub-code-error" : "hub-code-help"} aria-live="polite">
        {error || "Use the 6-character code on your teacher’s screen."}
      </p>
    </form>
  </section>;
}
