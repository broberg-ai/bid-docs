export const metadata = { title: "BID · Next.js-eksempel" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "3rem auto", padding: "0 1rem", lineHeight: 1.6 }}>
        {children}
      </body>
    </html>
  );
}
