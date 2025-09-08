import Image from "next/image";
import { Navbar } from "@/components/home/Navbar";
import { Zap, Camera, Wind } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { stats } from "@/constants/nav";

export default function TurbineHeroSection() {
  return (
    <header className="dark">
      <Navbar />

      <div className="relative isolate flex min-h-[500px] items-center pt-32 pb-16 lg:min-h-[768px] lg:pt-16">
        <Image
          src="/bg.jpg"
          alt="Wind turbines"
          fill
          className="object-cover object-center z-[-1]"
          priority
        />
        <div className="bg-background/60 absolute inset-0 z-[-1] h-full w-full"></div>
        <div className="mx-auto w-full max-w-2xl px-6 lg:max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary border border-primary/20">
              <Zap className="h-4 w-4" />
              Advanced Drone Technology
            </div>
            <h1 className="text-2xl/tight font-bold text-balance sm:text-5xl/tight lg:text-6xl/tight">
              Revolutionize Wind Turbine Inspections with AI-Powered Drone
              Technology
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base/7 text-pretty sm:text-lg/8 text-muted-foreground">
              Enhance safety, reduce costs, and maximize efficiency with our
              drone inspection platform. Get detailed blade analysis, real-time
              measurements, and comprehensive reports.
            </p>

            {/* CTA Buttons */}
            <div className="mx-auto mt-10 flex max-w-md flex-col gap-4 sm:flex-row sm:justify-center sm:max-w-none">
              <Button
                size="lg"
                aria-label="View demo gallery"
                className="text-base px-8"
                asChild
              >
                <Link href="/turbine">
                  <Camera className="mr-2 h-5 w-5" />
                  View Demo Gallery
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8"
                asChild
              >
                <Link href="/upload">
                  <Wind className="mr-2 h-5 w-5" />
                  Start Inspection
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="mx-auto mt-16 grid max-w-lg grid-cols-3 gap-8 sm:max-w-xl">
              {stats.map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-2xl font-bold sm:text-3xl">
                    {item.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
