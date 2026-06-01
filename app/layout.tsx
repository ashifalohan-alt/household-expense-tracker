import "./globals.css";

export const metadata = {
  title: "Family Expense Tracker",
  description: "Track household expenses together",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}