import { Composition } from "remotion";
import { ClipShort } from "./ClipShort";
import { QuizShort } from "./QuizShort";
import { VIDEO } from "./brand";
import { assertClipItem, timeline, type ClipItem } from "./clipTypes";
import { assertQuizItem, type QuizItem } from "./types";
import clips from "../data/clips.json";
import lote from "../data/lote.json";
import minijuegos from "../data/minijuegos.json";

const items: QuizItem[] = (lote as unknown[]).map(assertQuizItem);
const clipItems: ClipItem[] = [...(clips as unknown[]), ...(minijuegos as unknown[])].map(assertClipItem);

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

      {/* Vídeos con clip real: la duración depende de los tramos de cada vídeo. */}
      <Composition
        id="ClipShort"
        component={ClipShort}
        {...VIDEO}
        defaultProps={{ item: clipItems[0] }}
        calculateMetadata={({ props }) => ({ durationInFrames: timeline(props.item).total })}
      />
      {clipItems.map((item) => (
        <Composition
          key={item.slug}
          id={`Clip-${item.slug}`}
          component={ClipShort}
          {...VIDEO}
          durationInFrames={timeline(item).total}
          defaultProps={{ item }}
        />
      ))}
    </>
  );
};
