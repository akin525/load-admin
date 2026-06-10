import { ThemeProvider } from "@/components/ThemeProvider"
import { Sidebar } from "@/components/Sidebar"
import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen bg-slate-50 text-slate-950 dark:bg-[#07111f] dark:text-white">
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
        >
            <div className="flex min-h-screen bg-slate-50 dark:bg-[#07111f]">
                <Sidebar />

                <main className="flex-1 min-h-screen bg-slate-50 text-slate-950 transition-all duration-300 dark:bg-[#07111f] dark:text-white">
                    {children}
                </main>
            </div>
        </ThemeProvider>
        </body>
        </html>
    )
}