import type { ReactNode } from "react";

import { DemoSessionProvider } from "./demo-session";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoSessionProvider>{children}</DemoSessionProvider>;
}
