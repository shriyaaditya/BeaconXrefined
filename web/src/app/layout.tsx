"use client"

import './global.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Chatbutton from '@/components/ChatButton';
import Icon from '@/components/Icon';
import { usePathname } from 'next/navigation';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login';
  const sampleDisasters = [
    { type: "earthquake", id: "eq-1" },
    { type: "earthquake", id: "eq-2" },
    { type: "earthquake", id: "eq-3" },
    { type: "cyclone", id: "cy-1" },
    { type: "cyclone", id: "cy-2" },
  ];

  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        {!isAuthPage && <Navbar />}
        <main className="flex-1">
          {children}
        </main>        
        {!isAuthPage && <Icon disasters={sampleDisasters} />}
        {!isAuthPage && <Chatbutton />}
        {!isAuthPage && <Footer />}
      </body>
    </html>
  );
}