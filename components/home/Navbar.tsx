import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Logo } from "@/components/home/Logo";
import { navItems } from "@/constants/nav";

export function Navbar() {
  return (
    <nav className="absolute inset-x-0 z-50 mx-auto flex h-20 w-full max-w-7xl items-center gap-6 px-6">
      <Link href="/" className="inline-flex flex-1 items-center gap-2">
        <Logo />
        <span className="text-2xl font-bold tracking-tight">TurbineVision</span>
      </Link>

      <div className="hidden gap-2 lg:inline-flex">
        {navItems.map((item) => (
          <Button key={item.title} asChild variant={"ghost"}>
            <Link href={item.href}>{item.title}</Link>
          </Button>
        ))}
      </div>

      <div className="hidden flex-1 justify-end gap-2 lg:inline-flex">
        <Button asChild variant={"ghost"}>
          <Link href="#login">Log in</Link>
        </Button>
        <Button asChild>
          <Link href="/upload">Get Started</Link>
        </Button>
      </div>

      <Sheet>
        <SheetTrigger asChild className="ml-auto lg:hidden">
          <Button variant="outline" size="icon" aria-label="Open Menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex w-[90%] max-w-sm flex-col px-6 py-6"
        >
          <SheetTitle>
            <Link href="/" className="inline-flex items-center gap-2">
              <Logo />
              <span className="text-2xl font-bold tracking-tight">
                TurbineVision
              </span>
            </Link>
          </SheetTitle>
          <nav className="-mx-4 my-6 flex flex-1 flex-col gap-2">
            {navItems.map((item) => (
              <Button
                key={item.title}
                asChild
                className="justify-start text-base"
                variant={"ghost"}
              >
                <Link href={item.href}>{item.title}</Link>
              </Button>
            ))}
          </nav>
          <div className="mt-auto grid gap-2">
            <Button variant={"outline"} aria-label="Login" asChild>
              <Link href="#login">Log in</Link>
            </Button>
            <Button asChild aria-label="Upload">
              <Link href="/upload">Get Started</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
