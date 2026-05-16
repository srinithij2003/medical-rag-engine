import './globals.css';

export const metadata = {
  title: 'Offline Clinical Intelligence Platform',
  description: 'Local medical extraction UI for the OCIP backend',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
