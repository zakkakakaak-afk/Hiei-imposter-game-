import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Imposter",
  description: "A multiplayer secret-word party game."
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
