import { exampleName, examples, exampleTitle } from "./examples.js";
import type { Language, TranslationKey } from "./i18n.js";

interface ExamplesPanelProps {
  language: Language;
  t: (key: TranslationKey) => string;
  onClose: () => void;
  onSelectExample: (source: string) => void;
}

export function ExamplesPanel({ language, t, onClose, onSelectExample }: ExamplesPanelProps) {
  return (
    <section className="examples-panel">
      <div className="panel-title">
        <h2>{t("examples")}</h2>
        <button type="button" onClick={onClose}>
          {t("close")}
        </button>
      </div>
      <div className="examples-grid">
        {examples.map((example) => (
          <button key={exampleTitle(example) ?? example} type="button" onClick={() => onSelectExample(example)}>
            {exampleName(example, language)}
          </button>
        ))}
      </div>
    </section>
  );
}
