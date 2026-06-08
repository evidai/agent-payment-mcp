import { notFound } from "next/navigation";
import Screen1 from "../screens/Screen1";
import Screen2 from "../screens/Screen2";
import Screen3 from "../screens/Screen3";
import Screen4 from "../screens/Screen4";
import Screen5 from "../screens/Screen5";

const screens: Record<string, React.FC> = {
  "1": Screen1,
  "2": Screen2,
  "3": Screen3,
  "4": Screen4,
  "5": Screen5,
};

export default async function FreeeScreen({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const Screen = screens[id];
  if (!Screen) notFound();
  return <Screen />;
}
