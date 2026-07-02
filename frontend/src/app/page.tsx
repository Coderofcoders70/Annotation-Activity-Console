import ActivityConsole from "@/components/ActivityConsole";
import { StoreProvider } from "@/components/StoreProvider";

export default function Home() {
  return (
    <StoreProvider>
      <ActivityConsole />
    </StoreProvider>
  );
}
