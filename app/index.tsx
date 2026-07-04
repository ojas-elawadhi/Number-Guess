import HomeScreen from "../src/screens/HomeScreen";
import { useTutorialGate } from "../src/hooks/useTutorialGate";

export default function IndexRoute() {
  useTutorialGate();

  return <HomeScreen />;
}
