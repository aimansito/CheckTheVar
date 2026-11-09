import type { Metadata } from "next";
import { DailyGame } from "@/components/game/DailyGame";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Reto diario",
  description: "10 preguntas de fútbol, iguales para todos. Pulsa CHECK THE VAR y descubre si es gol.",
};

export default function DailyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <DailyGame />
      </main>
    </>
  );
}
