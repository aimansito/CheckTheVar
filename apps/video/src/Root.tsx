import { Composition } from "remotion";
import { QuizShort } from "./QuizShort";
import { VIDEO } from "./brand";
import { assertQuizItem, type QuizItem } from "./types";
import lote from "../data/lote.json";

const items: QuizItem[] = (lote as unknown[]).map(assertQuizItem);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Composición genérica: el script de render le pasa cada pregunta como props. */}
      <Composition
        id="QuizShort"
        component={QuizShort}
        {...VIDEO}
        defaultProps={{ item: items[0] }}
      />
      {/* Una composición por pregunta del lote, para previsualizar en el Studio. */}
      {items.map((item) => (
        <Composition
          key={item.slug}
          id={`Quiz-${item.slug}`}
          component={QuizShort}
          {...VIDEO}
          defaultProps={{ item }}
        />
      ))}
    </>
  );
};
